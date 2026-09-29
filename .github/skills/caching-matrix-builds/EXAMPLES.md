# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. No caching, oversized matrix, no timeouts
```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 19, 20, 21, 22, 23]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: node_modules
          key: modules                      # same key for every OS and Node version
      - run: npm install                    # not reproducible
      - run: npm run build && npm test      # rebuilt in each of the 18 jobs
```
**Why it's wrong:**
- 18 jobs, including unsupported odd-numbered Node versions; each rebuilds the project.
- A static cache key restores incompatible `node_modules` across OSes and versions.
- No `timeout-minutes`: a hung job can run for hours.

## Best Practice (How to do it right)

### 1. Cached install, build once, focused sharded matrix
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with: { name: dist, path: dist }

  test:
    needs: build
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node: [20, 22]
        shard: [1, 2, 3, 4]
        include:
          - { os: windows-latest, node: 22, shard: 1 }
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: '${{ matrix.node }}', cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
        with: { name: dist, path: dist }
      - run: npx vitest run --shard=${{ matrix.shard }}/4
```
### 2. Docker layer cache with BuildKit
```yaml
      - uses: docker/setup-buildx-action@e468171a9de216ec08956ac3ada2f0791b6bd435 # v3.11.1
      - uses: docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c83 # v6.18.0
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```
**Why it's right:**
- Dependencies are cached by the setup action with lock-file-based keys; the project is built once and reused.
- The matrix covers supported versions and a Windows smoke run, with tests sharded across four jobs.
- Timeouts cap every job, and Docker layers are reused across runs.
