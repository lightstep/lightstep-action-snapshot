const core = require('@actions/core')
const github = require('@actions/github')
const { snapshotDiff } = require('./snapshot/diff')
const { takeSnapshot } = require('./snapshot/api')
const { LightstepConfig } = require('@lightstep/lightstep-api-js').action

/**
 * Resolves input as an enviornment variable or action input
 * @param {*} name input name
 */
const resolveActionInput = (name, config = {}) => {
    if (typeof name !== 'string') {
        return null
    }
    const configName = name.replace('lightstep_', '')
    return process.env[name.toUpperCase()] || core.getInput(name) || config[configName]
}

/**
* Fails action if input does not exist
* @param {*} name input name
*/
const assertActionInput = (name, config) => {
    if (!resolveActionInput(name, config)) {
        core.setFailed(
            `Input ${name} must be set as an env var, passed as an action input`)
    }
}

module.exports.initAction = async () => {
    core.info('Starting action...')
}

module.exports.runAction = async () => {
    try {
        // Read `.lightstep.yml` file, if exists
        const config = new LightstepConfig(process.env.GITHUB_WORKSPACE || process.cwd())

        assertActionInput('lightstep_api_key')

        const apiKey = resolveActionInput('lightstep_api_key')
        const lightstepOrg = resolveActionInput('lightstep_organization') || config.lightstepOrg()
        const lightstepProj = resolveActionInput('lightstep_project') || config.lightstepProject()

        // For creating a snapshot
        var lightstepQuery = resolveActionInput('lightstep_snapshot_query')

        // For displaying the diff between two snapshots
        var snapshotCompareId = resolveActionInput('lightstep_snapshot_compare_id')
        const snapshotId = resolveActionInput('lightstep_snapshot_id')
        const serviceFilter = resolveActionInput('lightstep_service_filter')
        const disableComment = resolveActionInput('disable_comment')

        core.info(`Using lightstep project: ${lightstepProj}...`)
        core.info(`Using lightstep organization: ${lightstepOrg}...`)
        core.setOutput('lightstep_project', lightstepProj)
        core.setOutput('lightstep_organization', lightstepProj)

        // Take a new snapshot
        if (lightstepQuery) {
            assertActionInput('lightstep_snapshot_query')
            // The API doesn't support annotations...
            // so we add a special no-op to the query ;)
            lightstepQuery =
                `${lightstepQuery} AND "ignore.github.repo" NOT IN ("${process.env.GITHUB_REPOSITORY}")`
            core.info(`Creating snapshot for project ${lightstepProj}...`)
            const newSnapshotId = await takeSnapshot({ apiKey, lightstepOrg, lightstepProj, lightstepQuery })
            core.info(`Took snapshot ${newSnapshotId}...`)
            core.setOutput('lightstep_snapshot_id', newSnapshotId)
            return
        }

        if (!snapshotId) {
            core.setFailed('no input found: please specify a query to take a snapshot or snapshot id(s) to summarize')
            return
        }

        // Summarize existing snapshot(s)
        var snapshotAfterId
        var snapshotBeforeId

        if (snapshotId && snapshotCompareId) {
            snapshotAfterId = snapshotId
            snapshotBeforeId = snapshotCompareId
            core.info(`Analyzing difference between snapshots ${snapshotBeforeId} and ${snapshotAfterId}...`)
            const { markdown, graph, hasViolations } = await snapshotDiff(
                { apiKey, lightstepOrg, lightstepProj, snapshotBeforeId, snapshotAfterId, serviceFilter, config })
            core.setOutput('lightstep_snapshot_md', markdown)
            core.setOutput('lightstep_snapshot_dotviz', graph)
            if (hasViolations) {
                core.setOutput('lightstep_snapshot_has_violations', hasViolations)
            }
        } else if (snapshotId) {
            snapshotAfterId = snapshotId
            snapshotBeforeId = snapshotId
            core.info(`Analyzing snapshot ${snapshotBeforeId}...`)
        }

        const { markdown, graph, hasViolations } = await snapshotDiff(
            { apiKey, lightstepOrg, lightstepProj, snapshotBeforeId, snapshotAfterId, serviceFilter, config })
        core.setOutput('lightstep_snapshot_md', markdown)
        core.setOutput('lightstep_snapshot_dotviz', graph)
        if (hasViolations) {
            core.setOutput('lightstep_snapshot_has_violations', hasViolations)
        }

        // add pull request or issue comment
        if (disableComment !== 'true') {
            const token = resolveActionInput('github_token')
            var octokit
            try {
                octokit = github.getOctokit(token)
            } catch (e) {
                core.setFailed(`could not initialize github api client: ${e}`)
                return
            }

            const context = github.context
            if (context.issue && context.issue.number) {
                await octokit.issues.createComment({
                    issue_number : context.issue.number,
                    owner        : context.repo.owner,
                    repo         : context.repo.repo,
                    body         : markdown,
                })
            } else if (context.sha) {
                core.info(`attempting to find pr: ${context.repo.owner}/${context.repo.repo}@${context.sha}...`)
                const pulls = await octokit.repos.listPullRequestsAssociatedWithCommit({
                    owner      : context.repo.owner,
                    repo       : context.repo.repo,
                    commit_sha : context.sha,
                })
                if (pulls.data.length === 0) {
                    core.info('could not find a pull request associated with the git sha')
                    return
                }
                const num = pulls.data[0].number
                core.info(`commenting on pr #{num}...`)
                await octokit.issues.createComment({
                    issue_number : num,
                    owner        : context.repo.owner,
                    repo         : context.repo.repo,
                    body         : markdown
                })
            } else {
                core.info('could not find a SHA or issue number')
            }
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error)
        core.setFailed(error.message)
    }
}

