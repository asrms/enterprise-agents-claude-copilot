# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Grepping everything, chasing the loudest error
```bash
ssh app-01 'grep -i error /var/log/*.log | tail -100'     # one host, no time window, unstructured
# sees thousands of "CircuitBreaker OPEN for pricing" -> restarts the pricing service
# real cause (database connection pool exhaustion in pricing, started 10 minutes earlier) is never found
```
**Why it's wrong:**
- Searching one host without scope misses the pattern, and the loudest downstream error is mistaken for the cause.

## Best Practice (How to do it right)

### 1. Scope with metrics, aggregate structured logs, then follow a trace
```text
Metrics: checkout 5xx rose from 0.1% to 7% at 14:02 UTC, only eu-west-1, only version 7.3.4 of pricing-api
Timeline: 13:58 pricing-api 7.3.4 deployed (canary 50%); 14:02 errors start; 14:20 canary aborted; 14:24 recovery
```
```logql
# Loki: errors by type for pricing-api in the window, split by version
sum by (version, error_type) (
  count_over_time({service="pricing-api", region="eu-west-1"} | json | level="error" [5m])
)
```
```kusto
// Azure Monitor / Application Insights equivalent: slowest dependency calls for failed requests
requests
| where timestamp between (datetime(2026-09-29 13:55) .. datetime(2026-09-29 14:30))
| where cloud_RoleName == "pricing-api" and success == false
| join kind=inner (dependencies) on operation_Id
| summarize failures = count(), p95 = percentile(duration1, 95) by target1, type1
| order by failures desc
```
```text
Trace 7c1e0b2a9f (failed checkout):
  checkout-api   POST /checkout            5,012 ms  ERROR
   └─ pricing-api GET /prices              5,001 ms  ERROR (timeout)
       └─ db.pool.acquire                  4,998 ms  <- waiting for a connection
Finding: 7.3.4 opens a connection per price rule (N connections per request) -> pool exhausted -> timeouts upstream.
Gap closed: added pool wait time metric and span attribute db.pool.pending to pricing-api.
```
**Why it's right:**
- Metrics and the timeline narrow the scope to a version and region; aggregation shows the pattern; the trace pinpoints the first failing span.
- The explanation matches who was affected and when, and a missing signal is added for future investigations.
