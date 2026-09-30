# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Hero debugging and a blame postmortem
```text
10:02 alerts firing, three engineers debug in private messages
10:40 customer support learns about the outage from Twitter
11:30 someone finds the bad config and fixes it in production by hand
Postmortem: "Root cause: engineer X pushed a wrong config. Action: engineer X will be more careful."
```
**Why it's wrong:**
- No declared incident, roles, or communication; mitigation waits for full diagnosis.
- The postmortem blames a person and produces no systemic improvement.

## Best Practice (How to do it right)

### 1. Incident update template
```text
[SEV-1] Checkout failures in EU | Update #3 | 10:45 UTC
Impact:   ~35% of checkout attempts in EU failing since 10:02 UTC; other regions unaffected.
Status:   Mitigating. Config change 7.3.4 identified as likely trigger.
Actions:  Rolling back config to 7.3.3 (ops lead: A. Chen). Feature flag checkout-v2 disabled.
Next update: 11:15 UTC or sooner if status changes.
IC: R. Silva | Comms: J. Park | Channel: #inc-2026-09-29-checkout
```
### 2. Postmortem structure (excerpt)
```markdown
## Summary
A configuration change reduced the payment provider timeout from 10 s to 1 s. Between 10:02 and 10:58 UTC,
35% of EU checkout attempts failed (about 4,100 orders); error budget consumption: 62%.

## Contributing factors
- The timeout value was not validated against the provider's documented p99 latency (2.4 s).
- The config change skipped the canary stage because config deployments were not covered by progressive delivery.
- The burn-rate alert fired at 10:09, but the runbook did not mention recent config changes as a first check.

## What went well / where we got lucky
- The feature flag allowed partial mitigation within 5 minutes of declaring.
- Lucky: the change was deployed before the evening traffic peak.

## Action items
| Action                                                      | Type       | Owner      | Due        |
|-------------------------------------------------------------|------------|------------|------------|
| Validate timeout settings against dependency SLOs in CI      | Prevention | team-pay   | 2026-10-10 |
| Route config deployments through the canary pipeline         | Prevention | team-plat  | 2026-10-24 |
| Add "recent deploys and config changes" step to the runbook  | Mitigation | team-pay   | 2026-10-03 |
```
**Why it's right:**
- Updates follow a fixed format with impact, actions, owners, and the next update time.
- The postmortem quantifies impact, explains contributing factors in the system, and turns them into owned, dated actions.
