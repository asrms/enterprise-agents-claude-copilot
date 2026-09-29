---
name: k8s-autoscaling-resources
description: "Kubernetes resource management and autoscaling: right-sizing requests and limits, QoS classes, CPU throttling and memory OOM behavior, LimitRanges and ResourceQuotas, Horizontal Pod Autoscaler with CPU and custom metrics, KEDA event-driven scaling, Vertical Pod Autoscaler recommendations, and node autoscaling with Cluster Autoscaler or Karpenter. Use it when sizing or scaling workloads."
---

# Skill: Kubernetes Autoscaling and Resources

## Implementation Rules:
- **[MANDATORY]** Every container sets CPU and memory requests based on observed usage (p90-p95 over representative load plus headroom), and a memory limit; requests are what the scheduler guarantees, so under-requesting causes noisy-neighbor contention and over-requesting wastes nodes.
- **[PATTERN]** Memory limit equals or is close to the memory request for predictable behavior (Guaranteed or near-Guaranteed QoS for critical services); CPU limits are omitted or set generously for latency-sensitive services to avoid CFS throttling, unless strict multi-tenant isolation requires them.
- **[MANDATORY]** Runtimes respect container limits: JVM `-XX:MaxRAMPercentage`, Node.js `--max-old-space-size`, Go `GOMEMLIMIT` and `GOMAXPROCS`, .NET container-aware GC, so processes do not exceed the memory limit and get OOM-killed.
- **[PATTERN]** Namespaces have `LimitRange` defaults and `ResourceQuota`s per team or environment, so pods without explicit resources still get sane values and one team cannot exhaust the cluster.
- **[PATTERN]** Horizontal Pod Autoscaler (`autoscaling/v2`) scales stateless services on CPU utilization relative to requests or, better, on request rate, latency, or queue depth via custom/external metrics; configure `minReplicas` for availability and `behavior` policies to avoid flapping (stabilization windows, scale-down rate limits).
- **[PATTERN]** Use KEDA for event-driven workloads (queues, Kafka lag, cron schedules), including scale to zero for consumers and batch processors where cold start is acceptable.
- **[PATTERN]** Run the Vertical Pod Autoscaler in recommendation mode (`updateMode: "Off"`) to right-size requests; do not combine VPA auto-updates with an HPA on the same CPU or memory metric.
- **[PATTERN]** Node capacity scales automatically with Cluster Autoscaler or Karpenter, with node pools separated by workload type (general, memory-optimized, GPU, spot for interruptible work) using taints, tolerations, and node affinity.
- **[PERFORMANCE]** Use `PriorityClass`es so critical services preempt batch workloads under pressure, and PodDisruptionBudgets so node consolidation does not take down too many replicas at once.
- **[FORBIDDEN]** Pods without requests in production, HPA targets on workloads without requests, identical min and max replicas presented as autoscaling, and scaling on metrics that do not correlate with load.
- **[TESTING]** Validate sizing and scaling with load tests (k6, Locust) in a staging cluster: observe scale-up time, throttling (`container_cpu_cfs_throttled_periods_total`), OOM kills, and latency SLOs; review cost and utilization dashboards (Kubecost, OpenCost) regularly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
