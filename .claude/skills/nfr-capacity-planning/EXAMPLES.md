# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Vague, untestable requirements
```markdown
## Non-functional requirements
- The system must be fast.
- The system must be highly available (24/7).
- The system must scale.
- The system must be secure.
```
**Why it's wrong:**
- None of these can be verified, sized, or traded off; every design satisfies and violates them at the same time.

### 2. Sizing by guess
```text
"We'll start with 2 small instances and a db.t3.medium, we can always scale later."
Launch day: marketing campaign → 25× normal traffic, connection pool exhausted, checkout down for 3 hours.
```
**Why it's wrong:**
- No load model, no peak factor, and no known bottleneck (database connections) were considered before the campaign.

## Best Practice (How to do it right)

### 1. Vague, untestable requirements
```markdown
## Quality attribute scenarios — Checkout

| ID | Attribute | Scenario | Response measure | Verification |
|---|---|---|---|---|
| NFR-01 | Latency | Customer submits an order at peak load | p95 ≤ 300 ms, p99 ≤ 800 ms for POST /orders | k6 load test in CI (nightly) |
| NFR-02 | Availability | Normal operation over 30 days | ≥ 99.9% successful checkout requests (SLO), error budget 43 min/month | SLO dashboard + burn-rate alerts |
| NFR-03 | Resilience | One availability zone fails at peak | Checkout continues; no confirmed order lost | Quarterly zone failover drill |
| NFR-04 | Recoverability | Orders database corruption | RTO 1 h, RPO 5 min | Monthly point-in-time restore test |
| NFR-05 | Scalability | Black Friday | 10× average load (1,200 orders/min) with NFR-01 met | Stress test 2 weeks before |
| NFR-06 | Security | Payment data | No PAN stored; TLS 1.2+; PCI DSS SAQ A scope | Architecture review + ASV scan |
| NFR-07 | Cost | Normal load | ≤ €0.02 infrastructure cost per order | Monthly FinOps report |
```
**Why it's right:**
- Every requirement has a measurable target and a verification method with a trigger.
- Availability, resilience, recovery, growth, security, and cost are covered explicitly.

### 2. Sizing by guess
```text
Assumptions (reviewed with marketing):
  Average: 120 orders/min; campaign peak factor 10× → 1,200 orders/min = 20 orders/s
  Each order = 1 POST /orders + ~15 reads (cart, prices, stock) → ~320 requests/s at peak
  p95 latency target 300 ms → concurrency ≈ 320 × 0.3 ≈ 96 in-flight requests (Little's Law)

Database:
  Each order ≈ 6 writes, 20 ms each in one transaction → 20 tx/s × 0.12 s ≈ 2.4 busy connections on average
  Pool per instance: 10 connections; 6 instances at peak → 60 ≤ max_connections 200 (headroom for jobs/admin)

Compute:
  Load test: 1 instance sustains 80 req/s at 60% CPU → peak needs 4 instances, ×1.5 headroom → 6
  Autoscaling: min 3, max 10, target CPU 60%; pre-scale to 6 one hour before campaigns

Validation: k6 spike test 0 → 400 req/s in 60 s, soak test 2 h at 320 req/s, both meeting NFR-01.
```
**Why it's right:**
- Assumptions, formulas, and limits are written down and validated by tests, so the plan can be reviewed and updated as numbers change.
