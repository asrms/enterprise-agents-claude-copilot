# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Infrastructure metrics presented as SLOs
```text
SLO 1: CPU below 70%
SLO 2: average response time below 300 ms
SLO 3: 100% uptime of the orders-api pods
Error budget: not defined; SLOs not reviewed since they were written
```
**Why it's wrong:**
- None of these reflects what users experience; averages hide slow tail requests.
- A 100% target leaves no budget for change, and without a policy the numbers never influence decisions.

## Best Practice (How to do it right)

### 1. SLOs as code with Sloth (generates Prometheus recording rules and burn-rate alerts)
```yaml
version: prometheus/v1
service: checkout-api
labels: { owner: team-payments, tier: "1" }
slos:
  - name: requests-availability
    objective: 99.9
    description: Valid checkout requests that succeed (28-day window).
    sli:
      events:
        error_query: sum(rate(http_requests_total{service="checkout-api",route!="/healthz",code=~"(5..|429)"}[{{.window}}]))
        total_query: sum(rate(http_requests_total{service="checkout-api",route!="/healthz"}[{{.window}}]))
    alerting:
      name: CheckoutAvailabilityBurn
      labels: { category: availability }
      annotations: { runbook: "https://runbooks.example.com/checkout/availability" }
      page_alert: { labels: { severity: page } }
      ticket_alert: { labels: { severity: ticket } }
  - name: requests-latency
    objective: 99.0
    description: Checkout requests served in under 800 ms.
    sli:
      events:
        error_query: |
          sum(rate(http_request_duration_seconds_count{service="checkout-api",route!="/healthz"}[{{.window}}]))
          - sum(rate(http_request_duration_seconds_bucket{service="checkout-api",route!="/healthz",le="0.8"}[{{.window}}]))
        total_query: sum(rate(http_request_duration_seconds_count{service="checkout-api",route!="/healthz"}[{{.window}}]))
    alerting:
      name: CheckoutLatencyBurn
      page_alert: { labels: { severity: page } }
      ticket_alert: { labels: { severity: ticket } }
```
### 2. Error budget policy (excerpt)
```text
Budget (99.9%, 28 days): about 40 minutes of full unavailability or equivalent partial errors.
> 50% remaining: normal delivery; experiments allowed.
< 25% remaining: only low-risk changes; one reliability item per sprint prioritized.
Exhausted: feature launches frozen for checkout-api until budget recovers or VP Engineering approves an exception;
           postmortems for every incident that consumed > 10% of budget.
```
**Why it's right:**
- SLIs measure user-facing success and latency as good/valid ratios, excluding health checks.
- Burn-rate alerts are generated consistently from the specification, and the policy ties the budget to delivery decisions.
