---
name: gcp-serverless-cloud-run
description: "Serverless applications on Google Cloud with Cloud Run services, jobs, and functions: container best practices, concurrency and CPU allocation, minimum instances and startup CPU boost, revisions and traffic splitting, dedicated service accounts, Secret Manager integration, ingress and authentication settings, Direct VPC egress, Eventarc, Pub/Sub, Cloud Tasks and Workflows, and observability. Use it when building or reviewing serverless workloads on Google Cloud."
---

# Skill: Google Cloud Serverless with Cloud Run

## Implementation Rules:
- **[ARCHITECTURE]** Use Cloud Run services for HTTP and gRPC workloads, Cloud Run jobs for batch and scheduled tasks (with Cloud Scheduler), Cloud Run functions for small event handlers, Workflows for orchestration of multi-step processes, and Cloud Tasks or Pub/Sub for asynchronous work; choose GKE only when Cloud Run's model does not fit.
- **[MANDATORY]** Every service runs as its own user-managed service account with least-privilege roles on specific resources, never the default compute service account.
- **[MANDATORY]** Secrets come from Secret Manager mounted as volumes or environment variables referencing specific versions (not `latest` for critical secrets without rotation handling); no secrets in images or plain environment variables.
- **[PATTERN]** Configure ingress and authentication deliberately: `internal` or `internal-and-cloud-load-balancing` ingress for private services, IAM-based invocation (`roles/run.invoker` for specific callers), and public access only behind an external Application Load Balancer with Cloud Armor when exposed to the internet.
- **[PERFORMANCE]** Tune concurrency (requests per instance matching the runtime's capacity), CPU allocation (request-based billing for bursty APIs, instance-based for background processing), minimum instances and startup CPU boost for latency-sensitive services, and maximum instances to protect downstream systems.
- **[PATTERN]** Build small, fast-starting containers (multi-stage builds, distroless or slim bases, lazy initialization), listen on `$PORT`, handle `SIGTERM` for graceful shutdown, and keep instances stateless.
- **[PATTERN]** Deploy with revisions and traffic management: new revisions with tags for testing, gradual traffic splitting (for example 5%, 25%, 100%), and rollback by routing traffic to the previous revision; automate with Cloud Deploy or CI using workload identity federation.
- **[PATTERN]** Reach private resources through Direct VPC egress (or Serverless VPC Access connectors where needed) and connect to Cloud SQL with the Cloud SQL connector or Auth Proxy integration using IAM database authentication.
- **[FORBIDDEN]** `allUsers` invoker on internal services, the default compute service account with Editor, unbounded maximum instances in front of a database with limited connections, and long-running background work in request handlers with request-based CPU allocation.
- **[PATTERN]** Make event handlers idempotent (Pub/Sub and Eventarc deliver at least once), acknowledge only after successful processing, and configure dead-letter topics and retry policies.
- **[MANDATORY]** Observe services with Cloud Logging structured JSON logs (trace correlation fields), Cloud Monitoring SLOs and alerts on latency and error rate, and Cloud Trace via OpenTelemetry.
- **[TESTING]** Run containers locally and in CI with the same image, test tagged revisions before shifting traffic, and load-test concurrency and scaling settings against latency targets.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
