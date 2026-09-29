# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Random destruction without a hypothesis
```bash
# Friday 17:30, during a marketing campaign
kubectl delete pods --all -n payments          # "let's see what happens"
# no dashboards open, no abort plan, the payments team was not told
```
**Why it's wrong:**
- There is no hypothesis, blast radius, or abort condition, so the "experiment" is just an outage.
- It runs at peak time without the owning team, and nothing is learned or recorded.

## Best Practice (How to do it right)

### 1. Experiment plan
```text
Hypothesis: If the inventory service responds with 2 s extra latency for 10% of calls,
            checkout success stays >= 99.5% and p99 checkout latency <= 1.5 s,
            because the client timeout (800 ms) and fallback (cached stock) take over.
Scope:      production, checkout-api pods in eu-west-1 only, 10 minutes, Tuesday 10:00 UTC
Abort:      checkout success < 99% for 2 minutes, or manual stop by the experiment owner
Owner:      team-payments (observer: team-inventory informed)
```
### 2. Experiment as code (Chaos Mesh)
```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: inventory-latency
  namespace: payments
spec:
  action: delay
  mode: fixed-percent
  value: "10"
  selector:
    namespaces: [payments]
    labelSelectors: { app: checkout-api }
  direction: to
  target:
    mode: all
    selector:
      namespaces: [inventory]
      labelSelectors: { app: inventory-api }
  delay:
    latency: "2000ms"
    jitter: "200ms"
  duration: "10m"
```
### 3. Result record
```text
Outcome: hypothesis rejected. Checkout success dropped to 98.7% after 3 minutes; experiment aborted.
Finding: the fallback cache was bypassed for items added in the last hour (cache miss path had no timeout).
Actions: add a timeout to the cache-miss path (PAY-512); add an integration test with Toxiproxy latency (PAY-513);
         rerun the experiment after the fix.
```
**Why it's right:**
- The experiment has a user-facing hypothesis, limited scope, abort criteria, and informed owners.
- The fault is defined as code, and the result produces concrete fixes and a follow-up run.
