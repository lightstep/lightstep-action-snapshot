# lightstep-action-snapshot

The `lightstep/lightstep-action-snapshot` takes a [snapshot](https://lightstep.com/blog/snapshots-detailed-system-behavior-saved-shareable/) of a service in Lightstep.


## Requirements

### Lightstep

  * Instrumented service(s) running in a production environment
  * Lightstep API key

## Usage

This action can be run on `ubuntu-latest` GitHub Actions runner.

```
    steps:  
      - name: Checkout
        uses: actions/checkout@v2

      - name: Take Lightstep Snapshot
        id: lightstep-snapshot
        with:
          lightstep_api_key: api_key
          lightstep_organization: org
          lightstep_project: project
          lightstep_snapshot_query: service IN ("frontend")
```

## Examples

This workflow takes a snapshot of the `frontend` service when a GitHub deployment is created.

```yaml
on: deployment

jobs:
  deploy_check_job:
    runs-on: ubuntu-latest
    name: Verify Pre-Deploy Status

    steps:  
      - name: Checkout
        uses: actions/checkout@v2

      - name: Take Lightstep Snapshot
        uses: lightstep/lightstep-action-snapshot
        id: lightstep-snapshot
        with:
          lightstep_api_key: api_key
          lightstep_organization: org
          lightstep_project: project
          lightstep_snapshot_query: service IN ("frontend")
```

## Inputs

The following are **required**:

| Action Input             | Env var                   |
| ------------------------ | ------------------------- |
| `lightstep_organization` | `LIGHTSTEP_ORGANIZATION`  |
| `lightstep_project`      | `LIGHTSTEP_PROJECT`       |
| `lightstep_service`      | `LIGHTSTEP_SERVICE`       |
| `lightstep_api_key`      | `LIGHTSTEP_API_KEY`       |


## Outputs

* `lightstep_snapshot_id` - ID of the created snapshot.

## License

Apache License 2.0
