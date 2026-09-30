# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Guessed resources and a flapping HPA
```yaml
resources:
  requests: { cpu: 50m, memory: 64Mi }        # far below real usage
  limits: { cpu: 200m, memory: 4Gi }          # heavy throttling; memory can overcommit the node
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 1
  maxReplicas: 50
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 20 } }
```
**Why it's wrong:**
- Tiny requests make the utilization percentage meaningless and pack too many pods on a node; the low CPU limit throttles latency-sensitive requests.
- A memory limit far above the request allows pods to be OOM-killed or evicted when the node is under pressure.
- One replica minimum and an aggressive target with no behavior policy cause flapping and downtime.

## Best Practice (How to do it right)

### 1. Measured resources, runtime aware, stable HPA
```yaml
containers:
  - name: api
    env:
      - { name: JAVA_TOOL_OPTIONS, value: '-XX:MaxRAMPercentage=75' }
    resources:
      requests: { cpu: 500m, memory: 1Gi }     # p95 usage plus headroom from production metrics
      limits: { memory: 1Gi }                  # no CPU limit to avoid throttling
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: orders-api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: orders-api }
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 65 } }
    - type: Pods
      pods:
        metric: { name: http_requests_per_second }
        target: { type: AverageValue, averageValue: '80' }
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies: [{ type: Percent, value: 100, periodSeconds: 30 }]
    scaleDown:
      stabilizationWindowSeconds: 300
      policies: [{ type: Percent, value: 20, periodSeconds: 60 }]
```
### 2. Queue consumer scaled by KEDA, including to zero
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: invoice-worker }
spec:
  scaleTargetRef: { name: invoice-worker }
  minReplicaCount: 0
  maxReplicaCount: 20
  triggers:
    - type: rabbitmq
      metadata: { queueName: invoices, mode: QueueLength, value: '50' }
      authenticationRef: { name: rabbitmq-auth }
```
**Why it's right:**
- Requests reflect real usage, the JVM heap fits the memory limit, and there is no CPU throttling.
- The HPA scales on CPU and request rate with fast scale-up and slow, bounded scale-down, never below three replicas.
- Workers scale with queue length and cost nothing when idle.
