const template = require('lodash.template')
const path = require('path')

const { getServiceOnCall } = require('@lightstep/lightstep-api-js').integrations.pagerduty
const { getLastDeployVersions } = require('@lightstep/lightstep-api-js').integrations.rollbar

const fs = require('fs')

const tableTemplate = template(fs.readFileSync(path.resolve('./template/service_table.tmpl.md'), 'utf8'))
const summaryTemplate = template(fs.readFileSync(path.resolve('./template/summary.tmpl.md'), 'utf8'))


const viewHelpers = {
    icons : {
        // eslint-disable-next-line max-len
        ROLLBAR_ICON   : 'https://user-images.githubusercontent.com/27153/90803304-65a97980-e2cd-11ea-8267-a711fdcc6bc9.png',
        // eslint-disable-next-line max-len
        PAGERDUTY_ICON : 'https://user-images.githubusercontent.com/27153/90803915-4fe88400-e2ce-11ea-803f-47b9c244799d.png',
        // eslint-disable-next-line max-len
        LIGHTSTEP_ICON : 'https://user-images.githubusercontent.com/27153/90803298-6510e300-e2cd-11ea-91fa-5795a4481e20.png'
    },
    percentFormatter(service) {
        if (service.snapshot.errorPct === 0) {
            return `0%`
        }

        const errPct = (service.snapshot.errorPct && `${(service.snapshot.errorPct*100).toFixed(2)}%`) || ':question:'
        if (service.diff && service.diff.errorPct &&
            (service.diff.errorPct.pct !== 0)) {
            const change =  service.diff.errorPct.pct*100
            const sign = change < 0 ? '' : '+'
            const icon = change < 0 ? ':chart_with_downwards_trend: ' : ':chart_with_upwards_trend:'
            return `${icon} ${errPct} (${sign}${change.toFixed(2)}%)`
        }
        return `${errPct}`
    },
    latencyFormatter(service) {
        if (service.snapshot.avgDurationMs === 0) {
            return `0ms`
        }
        const avgDurationMs =
            (service.snapshot.avgDurationMs && `${(service.snapshot.avgDurationMs).toFixed(2)}ms`) || ':question:'
        if (service.diff && service.diff.avgDurationMs &&
            (service.diff.avgDurationMs.pct !== 0)) {
            const change = service.diff.avgDurationMs.pct*100
            const sign = change < 0 ? '' : '+'
            const icon = change < 0 ? ':chart_with_downwards_trend: ' : ':chart_with_upwards_trend:'
            return `${icon} ${avgDurationMs} (${sign}${change.toFixed(2)}%)`
        }
        return `${avgDurationMs}`
    },
    rollbarVersionErrors(r) {
        const url = `https://rollbar.com/${r.config.account}/${r.config.project}/versions/`
        if (r.error) {
            return ':exclamation: Problem retrieving error information from Rollbar'
        }
        if (r.versions && r.versions.item_stats && r.versions.item_stats.new) {
            const newErrors = r.versions.item_stats.new
            return `[\`${newErrors.error + newErrors.critical}\` new errors](${url}) since last deploy`
        }
        return ':question_mark: Could not find Rollbar error information'
    },
    snapshotLink(project, snapshotId) {
        return `https://app.lightstep.com/${project}/explorer?snapshot_id=${snapshotId}`
    },
    snapshotOperationLink(project, snapshotId, service, operation){
        const snapshotLink = viewHelpers.snapshotLink(project, snapshotId)
        const filterValue = `filter%5B0%5D%5Bvalue%5D=${encodeURIComponent(operation)}`
        const filterSelector = `${snapshotLink}&selected_node_id=${service}&filter%5B0%5D%5Btype%5D=built-in`
        const href = `${filterSelector}&filter%5B0%5D%5Bkey%5D=operation&${filterValue}`
        return `<a href="${href}">${operation}</a>`
    },
    snapshotFilterLink(title, project, snapshotId, service, key) {
        if (!key) {
            return title
        }
        const base = viewHelpers.snapshotLink(project, snapshotId)
        const params = `&selected_node_id=${service}&group_by_key=${key}&group_by_type=tag`
        return `<a href="${base}${params}">${title}</a>`
    },
    parseOnCall(pd) {
        if (pd && pd.oncalls) {
            return `<a href="${pd.service.html_url}">${pd.oncalls.map(o => o.user.summary).join(', ')}</a>`
        }

        if (pd && pd.error) {
            return ':exclamation: API Error'
        }
        return ':question:'
    }
}

/**
 * Gets details for a single service, including optional integrations
 */
const getServiceDetail = async function(s, config) {
    var onCall
    if (config.services()[s] && config.services()[s].integrations) {
        const integrations = config.services()[s].integrations

        // get pagerduty on-call information
        if (integrations.pagerduty && integrations.pagerduty.service) {
            onCall = getServiceOnCall({ apiToken : process.env.PAGERDUTY_API_TOKEN,
                service  : integrations.pagerduty.service })
        }
    }
    if (onCall) {
        return onCall.then(v => {
            return { service : s, pagerduty : v }
        }).catch(e => {
            return { service : s, pagerduty : { error : `${e}` } }
        })
    }

    return Promise.resolve().then(v => {
        return { service : s }
    })
}


/**
 *
 * Presents data in a way easily consumed by the markdown template.
 *
 * @param {*} model data
 */
const viewModel = async function({
    data,
    lightstepProj,
    serviceViolations,
    config
}) {
    const model = {
        lightstepProj,
        snapshotBeforeId : data.snapshotBeforeId,
        snapshotAfterId  : data.snapshotAfterId,
        integrations     : {
            pagerduty : { enabled : false },
            rollbar   : { enabled : false },
            gremlin   : { enabled : false }
        },
        snapshotCompare  : true,
        serviceTable     : [],
        newServicesCount : 0,
        delServicesCount : 0,
        helpers          : viewHelpers
    }

    if (data.snapshotBeforeId === data.snapshotAfterId) {
        model.snapshotCompare = false
    }

    // get detail for services in both snapshots + added services
    const services = Object.keys(data[data.snapshotAfterId].snapshot)
    const serviceDetail = services.map(s => {
        return getServiceDetail(s, config)
    })
    model.serviceTable = await Promise.all(serviceDetail)

    // annotate new services
    model.serviceTable.forEach(s => {
        const diff = data[`${data.snapshotBeforeId}_${data.snapshotAfterId}`]
        s.diff = diff.snapshot[s.service]
        s.snapshot = data[data.snapshotAfterId].snapshot[s.service]
        if (diff.diagram.added_services.includes(s.service)) {
            s.new_service = true
            s.newServicesCount = s.newServicesCount + 1
        }
        if (diff.diagram.deleted_services.includes(s.service)) {
            s.deleted_service = true
            s.delServicesCount = s.delServicesCount + 1
        }
        if (serviceViolations[s.service]) {
            s.violations = serviceViolations[s.service].violations
        }
    })

    // system integrations
    if (config.integrations().rollbar) {
        model.integrations.rollbar.enabled = true
        model.integrations.rollbar.config = config.integrations().rollbar
        const env = config.integrations().rollbar.environment
        await getLastDeployVersions(
            { token : process.env.ROLLBAR_API_TOKEN, environment : env }
        ).then(versions => {
            model.integrations.rollbar.versions = versions
        }).catch(err => {
            model.integrations.rollbar.error = err
        })
    }

    // service-to-partner integrations
    for (var s of model.serviceTable) {
        if (s.pagerduty) {
            model.integrations.pagerduty.enabled = true
            model.integrations.pagerduty.config = config.integrations().pagerduty
        }

        if (s.gremlin) {
            model.integrations.gremlin.enabled = true
            model.integrations.gremlin.config = config.integrations().gremlin
        }
    }
    return model
}

/**
 * Generates a markdown summary of the diff between two snapshots,
 * with optional partner integrations.
 *
 * @param {} model data
 */
const markdownSummary = async function({
    data,
    lightstepProj,
    serviceViolations,
    config
}) {
    const templateModel = await viewModel({
        data,
        lightstepProj,
        serviceViolations,
        config
    })
    const table = tableTemplate({... templateModel, inputTable : templateModel.serviceTable })
    const markdown = summaryTemplate({ ...templateModel, table })

    if (process.env.NODE_DEBUG) {
        // eslint-disable-next-line no-console
        console.log(markdown)
    }

    return markdown
}

module.exports = { markdownSummary }