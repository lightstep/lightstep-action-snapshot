const lightstepSdk = require('@lightstep/lightstep-api-js')
const { markdownSummary } = require('./markdown')
const { getSnapshotCached, getServiceDiagramCached, cacheSnapshots } = require('./api')
const core = require('@actions/core')

/**
 * Parses service configuration to search spans in a snapshot for potential violations
 * of user-configured rules (i.e. no 500s)
 * @param {} snapshotStats
 * @param {*} config
 */
const findViolationsByService = (snapshotSummary, config) => {
    const snapshotStats = snapshotSummary.snapshot
    const diagramStats = snapshotSummary.diagram
    var hasViolations = false
    const serviceViolations = Object.keys(snapshotStats).reduce((obj, s) => {
        const serviceViolations = config.services()[s] && config.services()[s].violations
        if (!serviceViolations) {
            return obj
        }
        var violations = []
        for (var v of config.services()[s].violations) {
            if (!v.type|| !v.name) {
                continue
            }
            var matches = []
            var msg = 'unknown violation'
            if (v.type === 'span.attributes' && v.op === 'equals') {
                matches = snapshotStats[s].exemplars.filter(e => e.attributes[v.key] === `${v.value}`)
            } else if (v.type === 'span.attributes' && v.op === 'unset') {
                matches = snapshotStats[s].exemplars.filter(e => e.attributes[v.key] === undefined)
            } else if (v.type === 'connection') {
                const exists = diagramStats.edges.includes(`${s}>${v.value}`)
                matches = exists ? [`${s}>${v.value}`] : []
            }

            if (matches.length === 0) {
                continue
            }

            hasViolations = true

            if (v.type == 'span.attributes') {
                msg = `Found ${matches.length} spans that violate the rule: ${v.name}`
            }

            if (v.type === 'connection') {
                msg = `${v.name}`
            }
            violations.push( { violation : v, matches, msg })
        }
        obj[s] = { service : s, violations }
        return obj
    }, {})
    return { serviceViolations, hasViolations }
}

/**
 * Tries to determine a snapshot to compare if one is
 * not specified.
 * @param {} param0
 */
async function selectBeforeSnapshot({
    apiClient, lightstepProj, snapshotAfterId
}) {
    const snapshotsReponse =  await apiClient.getSnapshots({ project : lightstepProj })
    const snapshots = snapshotsReponse.data
    if (snapshots.length === 0) {
        return null
    }

    const otherSnaps = snapshots.filter(s => s.id !== snapshotAfterId)
    if (otherSnaps.length === 0) {
        return null
    }

    // finds most recent snapshot associated with a GitHub repository
    if (process.env.GITHUB_REPO) {
        const snapshotsWithGithubMetadata =
            otherSnaps.filter(s => {
                const matches = s.attributes.query.match(/"ignore.github.repo".*?"(.*?)"/)
                return matches.length == 2 && matches[1] == process.env.GITHUB_REPO
            })

        if (snapshotsWithGithubMetadata.length > 0) {
            const mostRecent = snapshotsWithGithubMetadata[snapshotsWithGithubMetadata.length-1]
            core.info(`comparing with most recent repo snapshot: ${mostRecent.id}`)
            return mostRecent
        }
    }
    const mostRecent = otherSnaps[otherSnaps.length-1]
    core.info(`comparing with most recent snapshot: ${mostRecent.id}`)
    return mostRecent
}

/**
 * Performs analysis on two snapshots.
 *
 * If the snapshot is the same, a summary is generated of a single snapshot.
 *
 */
async function snapshotDiff(
    { apiKey, lightstepOrg, lightstepProj, snapshotBeforeId, snapshotAfterId, serviceFilter, config }) {

    const apiClient = await lightstepSdk.init(lightstepOrg, apiKey)

    // If set to '*', try to automatically detect
    // a snapshot to compare the provided snapshot with
    if (snapshotBeforeId === '*') {
        const beforeSnap = await selectBeforeSnapshot({ apiClient, lightstepProj, snapshotAfterId })

        if (beforeSnap === null) {
            core.setFailed(`could not determine a snapshot to compare with: ${snapshotAfterId}`)
            return
        }
        snapshotBeforeId = beforeSnap.id
    }

    const snapshotA = await getSnapshotCached(apiClient,
        { project : lightstepProj, snapshotId : snapshotBeforeId })

    const diagramA = await getServiceDiagramCached(apiClient,
        { project : lightstepProj, snapshotId : snapshotBeforeId })

    const snapshotB = await getSnapshotCached(apiClient,
        { project : lightstepProj, snapshotId : snapshotAfterId })

    const diagramB = await getServiceDiagramCached(apiClient,
        { project : lightstepProj, snapshotId : snapshotAfterId })

    // Calculate diff and get snapshot stats
    const beforeSummary = apiClient.utils.snapshotSummary(snapshotA, diagramA)
    const afterSummary = apiClient.utils.snapshotSummary(snapshotB, diagramB)
    const snapshotDiff = apiClient.utils.diffSummary(
        snapshotBeforeId, beforeSummary[snapshotBeforeId],
        snapshotAfterId, afterSummary[snapshotAfterId])
    const data = {
        snapshotBeforeId,
        snapshotAfterId,
        ...beforeSummary,
        ...afterSummary,
        ...snapshotDiff
    }

    const { serviceViolations, hasViolations } = findViolationsByService(afterSummary[snapshotAfterId], config)

    // Snapshot API is heavily rate limited, cache locally if possible.
    cacheSnapshots(snapshotA, diagramA, snapshotB, diagramB)
    // TODO: filter out services specified by GH Action config here
    if (serviceFilter) {
        const services = serviceFilter.split(",").map(s => s.trim())
        if (services.length > 0) {
            const filtered = Object.keys(data[snapshotAfterId].snapshot).reduce((obj, s) => {
                if (services.includes(s)) {
                    obj[s] = data[data.snapshotAfterId].snapshot[s]
                }
                return obj
            }, {})
            data[snapshotAfterId].snapshot = filtered
        }
    }

    const markdown = await markdownSummary({
        data,
        lightstepProj,
        serviceViolations,
        config
    })

    const graph = apiClient.diagramToGraphviz(diagramB).to_dot()

    return { graph, markdown, hasViolations }
}

module.exports = { snapshotDiff }