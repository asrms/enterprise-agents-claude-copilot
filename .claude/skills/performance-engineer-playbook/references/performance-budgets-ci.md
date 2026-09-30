# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Performance checked once a year
```text
- Load test run manually before Black Friday; results in a spreadsheet
- JavaScript bundle grew from 180 KB to 1.1 MB over 18 months; nobody noticed
- API p95 regressed 40% across 12 releases, 3-4% at a time
- Benchmarks exist but run on shared CI runners; results vary +/- 25%, so failures are ignored
```
**Why it's wrong:**
- Regressions accumulate unnoticed between rare manual tests, and noisy gates are ignored.

## Best Practice (How to do it right)

### 1. Frontend budgets with Lighthouse CI and size-limit
`lighthouserc.json`:
```json
{
  "ci": {
    "collect": { "url": ["http://localhost:3000/", "http://localhost:3000/products/trail-shoe"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 250000 }]
      }
    }
  }
}
```
`.size-limit.json`:
```json
[
  { "name": "initial JS", "path": "dist/assets/index-*.js", "limit": "170 KB", "gzip": true },
  { "name": "checkout route", "path": "dist/assets/checkout-*.js", "limit": "60 KB", "gzip": true }
]
```
### 2. Backend benchmark comparison (Go) on a dedicated runner
```bash
git stash && go test -run='^$' -bench=. -count=10 ./internal/pricing > old.txt
git stash pop && go test -run='^$' -bench=. -count=10 ./internal/pricing > new.txt
benchstat old.txt new.txt | tee benchstat.txt
# CI step fails if any benchmark shows a statistically significant slowdown > 5%
./scripts/check-benchstat.sh benchstat.txt --max-regression 5
```
```yaml
perf-gate:
  runs-on: [self-hosted, perf-dedicated]      # fixed hardware, one job at a time
  steps:
    - run: k6 run --quiet load/smoke.js        # thresholds: p95 < 300 ms at 50 req/s, errors < 0.5%
```
**Why it's right:**
- Budgets are explicit, versioned, and enforced on every change for frontend size and lab vitals.
- Backend comparisons use repeated runs and statistics on dedicated hardware, so gates are trustworthy.
