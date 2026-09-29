---
name: nfr-capacity-planning
description: "Defining measurable non-functional requirements and capacity plans: quality attribute scenarios (availability, latency, throughput, scalability, durability, security, cost), SLO targets and error budgets, back-of-the-envelope sizing, load models, RTO/RPO, and validation with load tests. Use it when specifying, sizing, or reviewing a system's non-functional requirements."
---

# Skill: NFRs and Capacity Planning

## Implementation Rules:
- **[MANDATORY]** Every non-functional requirement is measurable and testable: "fast" and "highly available" are rejected; write "p95 latency of `POST /orders` ≤ 300 ms at 200 requests/s sustained" or "monthly availability ≥ 99.9% measured at the load balancer".
- **[PATTERN]** Express quality attributes as scenarios (source, stimulus, environment, artifact, response, response measure), e.g. "When a zone fails during peak traffic, the checkout keeps working with p95 < 500 ms and no lost orders".
- **[MANDATORY]** Cover the relevant attributes explicitly: latency and throughput, availability, durability (data loss), recoverability (RTO/RPO), scalability (growth over 12–24 months), security and compliance, observability, maintainability, cost per transaction or per tenant.
- **[PATTERN]** Define SLIs and SLOs per user-facing journey (availability and latency percentiles over a 28/30-day window) with an error budget; internal dependencies need tighter SLOs than the services built on top of them.
- **[PATTERN]** Back-of-the-envelope sizing before choosing technology: daily active users → peak requests per second (use a peak factor of 2–10× the average), payload sizes → bandwidth, records per day × retention → storage, working set → cache size; write the assumptions next to the numbers.
- **[MANDATORY]** Build a load model from real or expected usage: mix of operations (e.g. 70% browse, 20% search, 8% add to cart, 2% checkout), arrival pattern (steady, daily curve, spikes such as campaigns), data volumes, and concurrency; performance tests reuse this model.
- **[PATTERN]** Plan headroom: size for projected peak × safety margin (e.g. 1.5–2×), keep sustained CPU below ~60–70% at peak, and define scaling triggers and limits (autoscaling min/max, database connection limits).
- **[MANDATORY]** RTO (maximum downtime) and RPO (maximum data loss) are defined per data store and service, and backup, replication, and multi-zone/region choices are justified by them; recovery is tested, not assumed.
- **[PATTERN]** Identify the bottleneck resources (database writes, locks, external APIs with rate limits, single-threaded consumers) and their limits early; apply Little's Law (concurrency = throughput × latency) to size pools and queues.
- **[PERFORMANCE]** Validate with load, stress, soak, and spike tests before launch and after significant changes; compare results against NFR targets and keep the reports.
- **[PATTERN]** Cost is a non-functional requirement: estimate monthly cost at expected and peak load, and track cost per unit (per order, per tenant, per 1,000 requests) as the system grows.
- **[FORBIDDEN]** NFRs copied from a template without stakeholder agreement, targets that nobody measures, and "five nines" without the architecture and budget to achieve them.
- **[SECURITY]** Security and privacy requirements are stated as verifiable controls (authentication method, encryption at rest and in transit, data residency, audit log retention, vulnerability remediation times).
- **[TESTING]** Each NFR has a verification method and owner: automated test, monitoring dashboard with alert, periodic drill (failover, restore), or audit.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
