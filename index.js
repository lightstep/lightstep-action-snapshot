const core = require('@actions/core')
const lightstepSdk = require('lightstep-js-sdk')

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

async function run() {
    try {
        assertActionInput('lightstep_api_key')
        assertActionInput('lightstep_organization')
        assertActionInput('lightstep_project')
        assertActionInput('lightstep_service')

        const apiKey = resolveActionInput('lightstep_api_key')
        const lightstepOrg = resolveActionInput('lightstep_organization')
        const lightstepProj = resolveActionInput('lightstep_project')
        const lightstepService = resolveActionInput('lightstep_service')

        const apiClient = await lightstepSdk.init(lightstepOrg, apiKey)
        core.info(`Creating snapshot for project ${lightstepProj}...`)
        const newSnapshot = await apiClient.sdk.apis.Snapshots.createSnapshot({
            organization : lightstepOrg,
            project      : lightstepProj,
            data         : {
                data : {
                    attributes : {
                        query : `service IN ("${lightstepService}")`
                    }
                }
            }
        })

        core.setOutput('lightstep_snapshot_id', newSnapshot.body.data.id)
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
