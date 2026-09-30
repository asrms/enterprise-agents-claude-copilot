# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Noisy, ignored scan with blanket suppressions
```yaml
# runs once a month, full report emailed as a PDF, pipeline never fails
sast:
  script:
    - semgrep --config auto . || true
```
```python
# nosemgrep                                   <- no rule id, no reason
cursor.execute(f"SELECT * FROM orders ORDER BY {request.args['sort']}")
```
**Why it's wrong:**
- Findings arrive too late and outside the developer workflow, and `|| true` means nothing is ever enforced.
- A blanket suppression hides a real SQL injection without explanation or review.

## Best Practice (How to do it right)

### 1. Semgrep and CodeQL on pull requests with SARIF upload (GitHub Actions)
```yaml
name: sast
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '23 3 * * 1'
permissions:
  contents: read
jobs:
  semgrep:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    container: { image: semgrep/semgrep }
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - run: semgrep scan --config p/default --config p/owasp-top-ten --config .semgrep/ --sarif --output semgrep.sarif --error --severity ERROR
      - if: always()
        uses: github/codeql-action/upload-sarif@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3.38.2
        with: { sarif_file: semgrep.sarif, category: semgrep }
  codeql:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    strategy:
      matrix: { language: [java-kotlin, javascript-typescript] }
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: github/codeql-action/init@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3.38.2
        with: { languages: '${{ matrix.language }}', queries: security-extended }
      - uses: github/codeql-action/autobuild@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3.38.2
      - uses: github/codeql-action/analyze@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3.38.2
```
### 2. Custom rule with tests
`.semgrep/no-raw-order-by.yaml`:
```yaml
rules:
  - id: no-raw-order-by
    languages: [python]
    severity: ERROR
    message: User input reaches ORDER BY. Map the value through an allow-list (see docs/secure-coding/sql.md).
    patterns:
      - pattern: $CUR.execute(f"...ORDER BY {$X}...")
      - pattern-not: $CUR.execute(f"...ORDER BY {SORT_COLUMNS[$KEY]}...")
```
`.semgrep/no-raw-order-by.py`:
```python
# ruleid: no-raw-order-by
cursor.execute(f"SELECT id FROM orders ORDER BY {request.args['sort']}")
# ok: no-raw-order-by
cursor.execute(f"SELECT id FROM orders ORDER BY {SORT_COLUMNS[key]}")
```
**Why it's right:**
- Scans run on every pull request and weekly on `main`, fail on high-severity findings, and report through code scanning annotations.
- CodeQL analyzes built code with extended security queries; custom rules encode local risks and are tested with `semgrep --test`.
- All actions are pinned to full commit SHAs with version comments.
