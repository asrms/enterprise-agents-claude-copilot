# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Duplicated workflow with mutable references
```yaml
# copied into 40 repositories, each slightly different
name: build
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - uses: some-org/setup-tool@master
      - run: |
          npm install
          npm run lint
          npm test
          npm run build
          # ... 150 more lines of inline shell
      - uses: acme/ci-workflows/.github/actions/scan@main
        with:
          token: ${{ secrets.SCAN_TOKEN }}
```
**Why it's wrong:**
- Every copy drifts; a fix must be applied 40 times.
- `@main`/`@master` references can change under you, including through a compromised upstream.
- Runs trigger on both push and pull request for every branch, with no concurrency control.

## Best Practice (How to do it right)

### 1. Central reusable workflow
`org/ci-workflows/.github/workflows/node-ci.yml`:
```yaml
name: node-ci
on:
  workflow_call:
    inputs:
      node-version:
        description: Node.js version to use
        type: string
        default: '22'
      working-directory:
        type: string
        default: '.'
    secrets:
      NPM_TOKEN:
        required: false
    outputs:
      artifact-name:
        description: Name of the uploaded build artifact
        value: ${{ jobs.build.outputs.artifact-name }}

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact-name: ${{ steps.meta.outputs.name }}
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm
      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - run: npm run lint && npm test -- --coverage && npm run build
      - id: meta
        run: echo "name=build-${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: ${{ steps.meta.outputs.name }}
          path: ${{ inputs.working-directory }}/dist
```
### 2. Thin caller in each repository
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
permissions:
  contents: read
jobs:
  ci:
    uses: org/ci-workflows/.github/workflows/node-ci.yml@8f4b7f84864484a7bf31766abe9204da3cbe65b3 # v3.2.0
    with:
      node-version: '22'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```
**Why it's right:**
- The pipeline is defined once, versioned, and consumed with a pinned SHA; Renovate/Dependabot proposes upgrades.
- Inputs, secrets, and outputs are explicit; permissions are minimal; superseded pull request runs are cancelled.
