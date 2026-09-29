---
name: monolith-decomposition
description: "Decomposing a monolith safely: first modularizing inside the monolith, identifying boundaries from domain and change coupling, enforcing module boundaries with architecture tests, extracting services only when justified, splitting shared databases (views, replication, database-per-service), handling transactions across services with sagas and outbox, managing shared code, and measuring progress. Use it when breaking up a monolithic application or its database."
---

# Skill: Monolith Decomposition

## Implementation Rules:
- **[ARCHITECTURE]** Modularize before distributing: turn the monolith into a modular monolith with explicit modules aligned to business capabilities, clear public APIs, and enforced dependency rules; extract a module into a separate service only when there is a concrete reason (independent scaling, deployment cadence, team autonomy, technology, or isolation).
- **[PATTERN]** Find boundaries with evidence: domain discovery (EventStorming, bounded contexts), change coupling from version control history (files that change together), runtime call graphs, and data ownership; prefer boundaries with high cohesion and few, well-defined interactions.
- **[MANDATORY]** Enforce module boundaries automatically with architecture tests or tooling (ArchUnit, Spring Modulith, NetArchTest, dependency-cruiser, Nx module boundaries, import-linter), and fail builds on new violations while burning down existing ones.
- **[PATTERN]** Replace direct cross-module calls into internals with module APIs or in-process events first; this prepares extraction and reveals hidden coupling.
- **[MANDATORY]** Give each module ownership of its data: separate schemas or tables per module inside the monolith database first, no cross-module joins or foreign keys to other modules' tables, and access to other modules' data only through their APIs or published read models.
- **[PATTERN]** Split the database in steps: logical separation (schemas), then database views or replicated read models for consumers during transition, then physical separation per service; synchronize with change data capture or events, never with dual writes from application code.
- **[PATTERN]** Replace distributed transactions with sagas (orchestrated or choreographed) and a transactional outbox for reliable event publishing; design compensating actions and idempotent handlers.
- **[FORBIDDEN]** Extracting services that share the same database tables, chatty synchronous call chains that recreate the monolith over the network (distributed monolith), shared domain libraries that couple deployments, and extracting everything at once.
- **[PATTERN]** Extract with the strangler approach: route calls for the capability to the new service behind a facade, migrate data, run in parallel if needed, then remove the module from the monolith.
- **[PATTERN]** Keep shared code minimal: technical libraries (logging, telemetry, security clients) may be shared and versioned; domain code is not shared between services.
- **[TESTING]** Protect each step with contract tests between modules and services, characterization tests for extracted behavior, and measure progress (boundary violations, cross-schema queries, deployment frequency, and incidents caused by coupling).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
