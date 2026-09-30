# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Minimal Deployment that fails in production
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:latest
          env:
            - name: DB_PASSWORD
              value: "S3cr3t!"                       # secret committed in the manifest
          livenessProbe:
            httpGet: { path: /health/db, port: 8080 } # restarts pods when the database is slow
```
**Why it's wrong:**
- A single replica, no resources, no readiness probe: every deployment and node drain causes downtime.
- `latest` makes rollouts and rollbacks non-deterministic; a plain-text secret is stored in Git.
- A liveness probe that depends on the database turns a database hiccup into a restart storm.

## Best Practice (How to do it right)

### 1. Resilient Deployment with probes, resources, spread, and PDB
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  labels:
    app.kubernetes.io/name: orders-api
    app.kubernetes.io/part-of: shop
spec:
  replicas: 3
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 300
  minReadySeconds: 10
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxUnavailable: 0, maxSurge: 25% }
  selector:
    matchLabels: { app.kubernetes.io/name: orders-api }
  template:
    metadata:
      labels: { app.kubernetes.io/name: orders-api, app.kubernetes.io/version: '1.4.2' }
    spec:
      terminationGracePeriodSeconds: 40
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector: { matchLabels: { app.kubernetes.io/name: orders-api } }
      containers:
        - name: api
          image: registry.example.com/orders-api:1.4.2@sha256:3b5c1f0e9a7d2c4b6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f
          ports: [{ name: http, containerPort: 8080 }]
          envFrom: [{ configMapRef: { name: orders-api-config } }]
          env:
            - name: DB_PASSWORD
              valueFrom: { secretKeyRef: { name: orders-db, key: password } }   # synced by External Secrets
          resources:
            requests: { cpu: 250m, memory: 384Mi }
            limits: { memory: 512Mi }
          startupProbe:   { httpGet: { path: /livez, port: http }, failureThreshold: 30, periodSeconds: 2 }
          readinessProbe: { httpGet: { path: /readyz, port: http }, periodSeconds: 5 }
          livenessProbe:  { httpGet: { path: /livez, port: http }, periodSeconds: 10, failureThreshold: 3 }
          lifecycle:
            preStop: { sleep: { seconds: 5 } }
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: orders-api
spec:
  maxUnavailable: 1
  selector:
    matchLabels: { app.kubernetes.io/name: orders-api }
```
**Why it's right:**
- Three replicas spread across zones, a PDB, and `maxUnavailable: 0` keep the service available during rollouts and node maintenance.
- Probes separate startup, readiness, and liveness; liveness checks only the process itself.
- Resources are declared, the image is pinned by digest, and the secret comes from an external manager.
