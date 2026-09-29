---
name: modular-monolith-vs-microservices
description: "Choosing and evolving the deployment architecture: modular monolith first, criteria for extracting microservices (team autonomy, scaling, fault isolation, release cadence), module boundaries and enforcement, database-per-service, distributed monolith smells, and the operational prerequisites for microservices. Use it when deciding or reviewing system decomposition."
---

# Skill: Modular Monolith vs Microservices

## Implementation Rules:
- **[ARCHITECTURE]** Default to a modular monolith for new products and small-to-medium teams: one deployable unit with strongly separated modules aligned to bounded contexts; extract services later when a concrete driver justifies the cost.
- **[MANDATORY]** Extract a microservice only for explicit, documented drivers (in an ADR): independent team ownership and release cadence, very different scaling or resource profiles, fault isolation of a risky or unstable part, different technology needs, or regulatory isolation; "microservices are modern" is not a driver.
- **[MANDATORY]** Module boundaries in a monolith are enforced, not conventional: each module exposes a public API (package/namespace, interface, or facade), internals are not accessible from other modules, and rules are checked in the build (ArchUnit, Spring Modulith `verify()`, .NET NetArchTest, dependency-cruiser, import-linter, Go `internal/` packages).
- **[PATTERN]** Each module owns its data: separate schemas or table prefixes with no cross-module joins or foreign keys; modules communicate through their public API or in-process domain events, so extraction later does not require untangling the database.
- **[FORBIDDEN]** The distributed monolith: services that must be deployed together, share a database, call each other synchronously in long chains, share domain libraries, or cannot be tested without starting the whole system.
- **[MANDATORY]** Operational prerequisites before running microservices: automated CI/CD per service, containerization and orchestration, centralized logging, metrics and distributed tracing, service discovery and configuration, API/contract testing, on-call ownership per service; without them, stay with a monolith.
- **[PATTERN]** Service granularity follows bounded contexts and team boundaries (a team owns one or a few services); avoid nano-services that split a single aggregate or require several services to change for one feature.
- **[PATTERN]** Prefer asynchronous, event-driven integration between services for workflows, and keep synchronous calls for queries that need an immediate answer, with timeouts, retries with backoff, and circuit breakers; avoid synchronous call chains deeper than two hops on a user request.
- **[PATTERN]** Migrate incrementally with the Strangler Fig pattern: route specific capabilities to the new service behind a facade/gateway, move data ownership with change data capture or dual-write via outbox, and remove the old code path once traffic is fully migrated.
- **[PERFORMANCE]** Account for the cost of distribution: network latency, serialization, partial failures, eventual consistency, and data duplication; model the latency budget of critical paths before splitting.
- **[SECURITY]** Microservices multiply the attack surface: service-to-service authentication (mTLS or workload identity, signed tokens with audience), per-service least-privilege credentials, and centralized policy for ingress.
- **[TESTING]** Monolith modules are tested in isolation through their public API; microservices rely on consumer-driven contract tests instead of large end-to-end suites to verify compatibility.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
