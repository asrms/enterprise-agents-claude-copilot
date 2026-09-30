# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Guess-driven optimization
```text
Symptom: /v1/reports p95 went from 300 ms to 2.4 s after release 5.2
Action:  developer rewrites the JSON serializer "because JSON is slow", adds a cache everywhere,
         doubles the pod memory; no profile, no before/after numbers
Result:  p95 still 2.3 s; memory grows until OOM kills the pods every 6 hours
```
**Why it's wrong:**
- Changes are based on intuition, not evidence, so the real bottleneck remains.
- An unbounded cache adds a memory leak, and without measurements nobody can tell what helped.

## Best Practice (How to do it right)

### 1. Measure, profile, fix, verify (JVM example with async-profiler)
```bash
# 1. Reproduce with the load test while capturing a CPU and wall-clock profile for 60 s
./asprof -e cpu -d 60 -f cpu.html <pid>
./asprof -e wall -t -d 60 -f wall.html <pid>      # off-CPU waits by thread

# 2. Allocation profile if GC time is high
./asprof -e alloc -d 60 -f alloc.html <pid>
```
```text
Findings (flame graphs):
- 58% of wall time in HikariPool.getConnection -> connection pool exhausted
- ReportService.buildRows issues 1 query per row (N+1): 2,300 queries per request
- CPU flame graph: 22% in String.format inside a debug log statement evaluated even when disabled

Fix 1: batch query with JOIN (1 query per request)
Fix 2: parameterized logging (log.debug("row {}", id)) so formatting happens only when enabled

Verification (same k6 scenario, 200 req/s):
            p95      CPU/req   queries/req   GC time
before      2.4 s    41 ms     2,300         9%
after       280 ms   6 ms      1             2%
Guard: integration test asserts <= 3 queries for the report endpoint; k6 threshold p95 < 400 ms in nightly run
```
**Why it's right:**
- Wall-clock profiling revealed waiting on the pool, which a CPU profile alone would have missed.
- Each fix targets a measured contributor, the improvement is verified with the same workload, and regression guards are added.
