# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unmeasurable wishes
```text
Non-functional requirements for the booking platform:
- The system must be fast.
- The system must be highly available (100%).
- The system must be secure and GDPR compliant.
- The system must scale.
```
**Why it's wrong:**
- None of these can be tested or used to make design decisions, and 100% availability is neither achievable nor affordable.
- Security and privacy obligations are not specified, so they will be discovered late.

## Best Practice (How to do it right)

### 1. Measurable requirements with sources and verification
```text
| ID     | Attribute     | Requirement (measurable)                                                            | Source                  | Priority | Verification                    |
|--------|---------------|--------------------------------------------------------------------------------------|-------------------------|----------|---------------------------------|
| NFR-01 | Performance   | p95 < 400 ms, p99 < 1 s for availability search at 300 req/s                         | UX research, peak 2025  | High     | k6 load test in CI (nightly)    |
| NFR-02 | Availability  | 99.9% of valid booking requests succeed over 28 days                                 | Partner contract SLA    | High     | SLO + burn-rate alerts          |
| NFR-03 | Recoverability| RPO 5 min, RTO 1 h for booking data after regional failure                           | Business impact analysis| High     | Quarterly restore/failover drill|
| NFR-04 | Security      | OWASP ASVS 4.0.3 level 2; MFA for back-office users                                   | Security policy SEC-02  | High     | ASVS checklist, pen test        |
| NFR-05 | Privacy       | Guest personal data deleted 24 months after last stay; export within 30 days          | GDPR Art. 5, 15, 17     | High     | Automated retention and DSR tests |
| NFR-06 | Accessibility | Booking flow meets WCAG 2.2 AA                                                        | Legal, brand policy     | High     | axe in CI + manual audit        |
| NFR-07 | Scalability   | Handles 3x current peak (900 req/s) by adding instances, without code changes        | Growth plan 2027        | Medium   | Capacity test before peak season|
| NFR-08 | Cost          | Infrastructure cost < 0.04 EUR per booking at expected volume                         | Business case           | Medium   | Monthly FinOps report           |
```
### 2. Quality attribute scenario
```text
Source: availability zone failure | Stimulus: all instances in one zone lost
Environment: peak traffic (300 req/s) | Artifact: booking API and database
Response: traffic shifts to healthy zones; database fails over automatically
Response measure: error rate < 1% after 2 minutes; no committed bookings lost
```
**Why it's right:**
- Every requirement has a number, a source, a priority, and a verification method linked to tests or SLOs.
- The scenario makes the resilience expectation concrete enough to drive design and chaos testing.
