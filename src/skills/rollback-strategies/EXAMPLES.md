# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. "Rollback" by rebuilding and hand-editing production
```bash
git checkout v4.1.0
docker build -t api:latest . && docker push api:latest     # new image: different dependency versions
kubectl set image deploy/api api=api:latest                 # mutable tag, no record of what runs
kubectl exec -it deploy/api -- psql -c "ALTER TABLE ..."   # manual schema change under pressure
```
**Why it's wrong:**
- The rebuilt image is not the artifact that was tested; `latest` hides what is deployed.
- Manual production changes are unreviewed and unrecorded, making the incident harder to resolve.

## Best Practice (How to do it right)

### 1. Canary with automated abort (Argo Rollouts)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: orders-api }
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
      analysis:
        templates: [{ templateName: error-rate-and-latency }]
        startingStep: 1
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: error-rate-and-latency }
spec:
  metrics:
    - name: error-rate
      interval: 1m
      failureLimit: 2
      successCondition: result[0] < 0.01
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{service="orders-api",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{service="orders-api"}[5m]))
```
### 2. Runbook excerpt: rollback decision and execution
```text
1. Mitigate first: disable flag `checkout-v2-enabled` (expected effect < 1 min).
2. Still degraded? Abort rollout: kubectl argo rollouts abort orders-api
3. Already fully rolled out? Redeploy previous digest through the pipeline:
   deploy workflow -> input digest = sha256:<previous> (from release record v4.1.0)
4. Database: release 4.2 only expanded the schema -> no schema rollback needed.
5. Mark 4.2.0 as blocked in the release registry, post status update, open ticket for the fix.
```
**Why it's right:**
- Bad canaries are aborted automatically based on SLO-aligned metrics before most users are affected.
- Manual rollback uses the same pipeline and a known digest, preceded by the fastest lever (the kill switch).
- Schema compatibility makes the application rollback safe, and the bad version is blocked from re-promotion.
