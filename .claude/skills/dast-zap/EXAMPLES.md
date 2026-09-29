# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unauthenticated full scan against production
```bash
docker run -t zaproxy/zap-stable zap-full-scan.py -t https://shop.example.com   # production, no auth, no rules
# result: 300 alerts in an HTML file nobody reads; login-protected pages never scanned;
# the scan submitted thousands of forms and sent real emails to customers
```
**Why it's wrong:**
- Active scanning production can cause side effects and outages and is not authorized.
- Without authentication most of the application is untested, and without rule tuning results are noise.

## Best Practice (How to do it right)

### 1. ZAP Automation Framework plan for an ephemeral environment
`security/zap-plan.yaml`:
```yaml
env:
  contexts:
    - name: shop
      urls: ["${TARGET_URL}"]
      excludePaths: ["${TARGET_URL}/logout.*"]
      authentication:
        method: browser
        parameters:
          loginPageUrl: "${TARGET_URL}/login"
      users:
        - name: customer
          credentials: { username: "${ZAP_USER}", password: "${ZAP_PASSWORD}" }
  parameters:
    failOnError: true
    progressToStdout: true
jobs:
  - type: openapi
    parameters: { apiUrl: "${TARGET_URL}/v3/api-docs", context: shop }
  - type: spiderAjax
    parameters: { context: shop, user: customer, maxDuration: 5 }
  - type: passiveScan-wait
  - type: activeScan
    parameters: { context: shop, user: customer, maxScanDurationInMins: 30 }
  - type: report
    parameters: { template: sarif-json, reportDir: /zap/wrk, reportFile: zap.sarif }
```
```bash
docker run --rm -v "$PWD/security:/zap/wrk" \
  -e TARGET_URL=https://pr-482.preview.example.com -e ZAP_USER -e ZAP_PASSWORD \
  zaproxy/zap-stable zap.sh -cmd -autorun /zap/wrk/zap-plan.yaml
```
### 2. Baseline scan with a tuned rules file on every preview deployment
`security/zap-rules.tsv`:
```text
10038	FAIL	(Content Security Policy header not set)
10020	FAIL	(Missing anti-clickjacking header)
10096	IGNORE	(Timestamp disclosure: build ids in static asset names, reviewed 2026-08)
```
```bash
docker run --rm -v "$PWD/security:/zap/wrk" zaproxy/zap-stable \
  zap-baseline.py -t https://pr-482.preview.example.com -c zap-rules.tsv -r baseline.html
```
**Why it's right:**
- Scans target isolated preview environments, authenticate as a test user, and import the API definition for coverage.
- Rules are tuned in version control with justifications, and results are exported as SARIF for triage alongside other scanners.
