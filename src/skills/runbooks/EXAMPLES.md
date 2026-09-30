# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Runbook that cannot be followed
```text
Title: DB issues
If the database is slow, check the database and restart things if needed.
Ask Sam if unsure. Password for admin is in Sam's notes.
(last edited 2022)
```
**Why it's wrong:**
- No meaning, impact, commands, or decision points; it depends on one person and an unknown password.
- It is outdated and unowned, so on-call engineers cannot trust it.

## Best Practice (How to do it right)

### 1. Structured, executable runbook
`runbooks/checkout/high-error-rate.md`:
```markdown
# Checkout high error rate (CheckoutErrorBudgetFastBurn)
Owner: team-payments | Last reviewed: 2026-09-15 | Severity: page

## What it means
More than 1.4% of checkout requests fail over 1 hour and 5 minutes; customers cannot pay.

## Quick checks (2 minutes)
1. Dashboard: https://grafana.example.com/d/checkout?var-region=All
2. Recent changes: https://deploys.example.com/?service=checkout-api&since=2h (deploys, config, flags)
3. Payment provider status: https://status.payments-provider.example.com

## Mitigation (safest first)
1. If a deploy or config change happened in the last 2 hours: roll back via the deploy workflow
   (input: previous digest from the release page). Expected recovery: 5 minutes.
2. If errors come from the payment provider (5xx from `provider-gateway` spans): disable flag
   `checkout-v2-enabled` and enable `payments-fallback-provider` (requires IC approval).
3. If one region only: shift traffic away with `./ops/traffic-shift.sh --service checkout --from <region> --percent 100`.

## Diagnosis
- Errors by route and code:
  `sum by (route, code) (rate(http_requests_total{service="checkout-api",code=~"5.."}[5m]))`
- Traces with errors: https://tempo.example.com/search?service=checkout-api&status=error

## Escalation
Payments on-call (secondary) -> Payments engineering manager -> Provider support (contract id in the vault entry "provider-support").

## Verify recovery
Error ratio below 0.1% for 15 minutes and burn-rate alert resolved; post the confirmation in the incident channel.
```
**Why it's right:**
- The runbook explains meaning and impact, gives quick checks, ordered mitigations with commands and approvals, and a clear recovery criterion.
- It has an owner and review date, links to live data, and references secrets by vault location instead of embedding them.
