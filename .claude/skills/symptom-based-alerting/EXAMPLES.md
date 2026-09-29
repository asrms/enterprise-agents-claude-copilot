# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Cause-based pages without context
```yaml
- alert: HighCPU
  expr: node_cpu_usage > 0.8          # pages at 3 a.m. while users are unaffected
  labels: { severity: critical }
- alert: PodRestarted
  expr: increase(kube_pod_container_status_restarts_total[5m]) > 0
  labels: { severity: critical }
  annotations: { summary: "pod restarted" }    # no runbook, no impact, no owner
```
**Why it's wrong:**
- Pages fire for internal causes that often have no user impact, training on-call engineers to ignore alerts.
- The alerts carry no runbook, owner, or context to act on.

## Best Practice (How to do it right)

### 1. Symptom-based alert with context and a unit test
```yaml
groups:
  - name: checkout-symptoms
    rules:
      - alert: CheckoutErrorBudgetFastBurn
        expr: |
          (
            sum(rate(http_requests_total{service="checkout-api",code=~"5.."}[1h]))
            / sum(rate(http_requests_total{service="checkout-api"}[1h]))
          ) > (14.4 * 0.001)
          and
          (
            sum(rate(http_requests_total{service="checkout-api",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{service="checkout-api"}[5m]))
          ) > (14.4 * 0.001)
        labels: { severity: page, team: payments, service: checkout-api }
        annotations:
          summary: "Checkout failing for users: error budget burning 14x"
          impact: "Customers cannot complete purchases"
          runbook_url: "https://runbooks.example.com/checkout/high-error-rate"
          dashboard: "https://grafana.example.com/d/checkout"
      - alert: CheckoutTelemetryMissing
        expr: absent(up{job="checkout-api"} == 1)
        for: 10m
        labels: { severity: page, team: payments }
        annotations:
          summary: "No healthy checkout-api targets are being scraped"
          runbook_url: "https://runbooks.example.com/checkout/telemetry-missing"
```
`checkout-symptoms.test.yaml`:
```yaml
rule_files: [checkout-symptoms.yaml]
evaluation_interval: 1m
tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{service="checkout-api",code="500"}'
        values: '0+20x70'
      - series: 'http_requests_total{service="checkout-api",code="200"}'
        values: '0+980x70'
    alert_rule_test:
      - eval_time: 65m
        alertname: CheckoutErrorBudgetFastBurn
        exp_alerts:
          - exp_labels: { severity: page, team: payments, service: checkout-api }
            exp_annotations:
              summary: "Checkout failing for users: error budget burning 14x"
              impact: "Customers cannot complete purchases"
              runbook_url: "https://runbooks.example.com/checkout/high-error-rate"
              dashboard: "https://grafana.example.com/d/checkout"
```
**Why it's right:**
- The page fires only when users are affected at a rate that threatens the SLO, confirmed over a long and a short window.
- Annotations state impact and link a runbook and dashboard; missing telemetry is detected too.
- The rule is unit-tested with synthetic data (a 2% error rate exceeds the 1.44% threshold).
