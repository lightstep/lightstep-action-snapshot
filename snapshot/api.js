const lightstepSdk = require('@lightstep/lightstep-api-js')
const path = require('path')
const fs = require('fs')

module.exports.takeSnapshot = async({ apiKey, lightstepOrg, lightstepProj, lightstepQuery }) => {
    const apiClient = await lightstepSdk.init(lightstepOrg, apiKey)
    const newSnapshot = await apiClient.sdk.apis.Snapshots.createSnapshot({
        organization : lightstepOrg,
        project      : lightstepProj,
        data         : {
            data : {
                attributes : {
                    query : lightstepQuery
                }
            }
        }
    })
    return newSnapshot.body.data.id
}

const SNAPSHOT_DIR = path.join('/tmp', 'lightstep')

function snapshotCachePath(id, type = '') {
    return path.join(SNAPSHOT_DIR, `lightstep-snapshot${type}-${id}.json`)
}

module.exports.getServiceDiagramCached = async (apiClient, { project, snapshotId }) => {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR)
    }

    if (fs.existsSync(snapshotCachePath(snapshotId, 'diagram'))) {
        const snapshotFile = fs.readFileSync(snapshotCachePath(snapshotId, 'diagram'), 'utf-8')
        // eslint-disable-next-line no-console
        console.log(`getting ${snapshotId} diagram snapshot from cache...`)
        return JSON.parse(snapshotFile)
    }

    const diagram = await apiClient.getServiceDiagram({ project, snapshotId })
    return diagram
}

/**
 * Gets a locally cached *.json file that represents the snapshot API response.
 *
 * @param {} apiClient
 * @param {*}
 */
module.exports.getSnapshotCached = async(apiClient, { project, snapshotId }) => {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR)
    }

    if (fs.existsSync(snapshotCachePath(snapshotId))) {
        const snapshotFile = fs.readFileSync(snapshotCachePath(snapshotId), 'utf-8')
        // eslint-disable-next-line no-console
        console.log(`getting ${snapshotId} snapshot from cache...`)
        return JSON.parse(snapshotFile)
    }

    const diagram = await apiClient.getSnapshot({ project, snapshotId })
    return diagram
}

module.exports.cacheSnapshots = function(snapshotA, diagramA, snapshotB, diagramB) {
    if (!process.env.DISABLE_CACHE_SNAPSHOTS) {
        try {
            fs.writeFileSync(
                snapshotCachePath(snapshotA.data.id),
                JSON.stringify(snapshotA))
            fs.writeFileSync(
                snapshotCachePath(diagramA.data.id, 'diagram'),
                JSON.stringify(diagramA))
            fs.writeFileSync(
                snapshotCachePath(snapshotB.data.id),
                JSON.stringify(snapshotB))
            fs.writeFileSync(
                snapshotCachePath(diagramB.data.id, 'diagram'),
                JSON.stringify(diagramB))
        } catch (e) {
            return e
        }
    }
}