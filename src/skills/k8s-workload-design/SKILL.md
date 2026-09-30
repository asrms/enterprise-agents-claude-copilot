---
name: k8s-workload-design
description: "Production-ready Kubernetes workloads: choosing Deployment, StatefulSet, Job, CronJob, or DaemonSet, probes (startup, readiness, liveness), graceful termination, rolling update strategy, PodDisruptionBudgets, topology spread, configuration with ConfigMaps and Secrets, labels, and immutable image digests. Use it when writing or reviewing Kubernetes manifests."
---

# Skill: Kubernetes Workload Design

## Implementation Rules:
- **[ARCHITECTURE]** Pick the right controller: `Deployment` for stateless services, `StatefulSet` only for workloads needing stable identity and storage (prefer managed databases or operators over hand-rolled stateful sets), `Job`/`CronJob` for batch work with `backoffLimit`, `activeDeadlineSeconds`, and `concurrencyPolicy`, `DaemonSet` for per-node agents.
- **[MANDATORY]** Every container defines probes appropriate to its behavior: a `startupProbe` for slow starts, a `readinessProbe` that reflects ability to serve traffic, and a `livenessProbe` that detects only unrecoverable states (never checking external dependencies, which would cause cascading restarts).
- **[MANDATORY]** Every container declares CPU and memory `requests` and a memory `limit`; images are referenced by immutable tag plus digest (`app:1.4.2@sha256:...`), never `latest`, with `imagePullPolicy: IfNotPresent`.
- **[PATTERN]** Graceful termination: the application handles `SIGTERM` by failing readiness and draining in-flight work; `terminationGracePeriodSeconds` exceeds the drain time, and a short `preStop` sleep covers endpoint propagation delay when needed.
- **[PATTERN]** High availability: at least two replicas for user-facing services, `topologySpreadConstraints` across zones and nodes, a `PodDisruptionBudget` (`maxUnavailable: 1` or `minAvailable`), and a `RollingUpdate` strategy with `maxUnavailable: 0` and a sensible `maxSurge` for zero-downtime rollouts.
- **[PATTERN]** Configuration comes from `ConfigMap`s and `Secret`s mounted as files or environment variables; secrets are sourced from an external manager (External Secrets Operator, Secrets Store CSI Driver, Sealed Secrets) rather than committed in plain YAML; config changes trigger rollouts through hashed names or checksum annotations.
- **[PATTERN]** Apply the recommended labels (`app.kubernetes.io/name`, `instance`, `version`, `component`, `part-of`, `managed-by`) consistently and use them in selectors, which are immutable and must stay stable.
- **[PATTERN]** One main process per container; sidecars only for cross-cutting concerns (native sidecar containers via `initContainers` with `restartPolicy: Always`), and init containers for one-time setup that must complete before start.
- **[FORBIDDEN]** Bare Pods in production, `hostPath` volumes for application data, `hostNetwork`/`hostPID` for applications, running database migrations in every replica's startup, and relying on pod IPs or names for service discovery instead of Services.
- **[PERFORMANCE]** Set `revisionHistoryLimit` to a small number, `progressDeadlineSeconds` to detect stuck rollouts, and use `minReadySeconds` so a pod must stay ready before the rollout continues.
- **[TESTING]** Validate manifests in CI with `kubeconform` (schema), `kube-linter` or Polaris (best practices), and a dry-run against the target API version (`kubectl apply --dry-run=server`); test rollouts and pod disruptions in a staging cluster.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
