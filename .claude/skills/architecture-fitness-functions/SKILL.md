---
name: architecture-fitness-functions
description: "Protecting architecture characteristics with automated fitness functions: dependency and layering rules (ArchUnit, NetArchTest, dependency-cruiser, import-linter), cycle detection, API compatibility checks, performance and security budgets in CI, and architecture drift monitoring. Use it when you want architectural decisions to be enforced automatically."
---

# Skill: Architecture Fitness Functions

## Implementation Rules:
- **[ARCHITECTURE]** For every important architecture characteristic (modularity, layering, performance, security, availability, compatibility), define at least one fitness function: an objective, automated check that fails when the characteristic degrades.
- **[MANDATORY]** Dependency rules as tests in the build: ArchUnit (Java/Kotlin), NetArchTest or ArchUnitNET (.NET), dependency-cruiser or eslint-plugin-boundaries (JS/TS), import-linter (Python), `depguard`/`go-arch-lint` and `internal/` packages (Go), cargo workspace boundaries (Rust).
- **[MANDATORY]** Enforce: allowed dependencies between layers (domain depends on nothing framework-specific; adapters depend on the domain, not the reverse), module encapsulation (no access to other modules' internals), and absence of dependency cycles between packages/modules.
- **[PATTERN]** Naming and placement conventions as rules where they carry meaning (e.g. classes annotated as controllers live in `adapter.in.web`, repositories only in persistence adapters), not for cosmetic preferences.
- **[PATTERN]** API compatibility fitness functions: OpenAPI/AsyncAPI/Protobuf breaking change detection in CI (`oasdiff breaking`, `buf breaking`), consumer contract verification (`can-i-deploy`), and database migration compatibility checks.
- **[PATTERN]** Operational fitness functions: performance budgets (p95 latency and throughput from load tests, bundle size and Core Web Vitals for frontends), container image size, startup time, and resource limits checked on each release.
- **[PATTERN]** Security fitness functions: SAST/SCA thresholds, secrets detection, IaC policy checks (OPA/Conftest, Checkov), TLS and header configuration tests, and dependency license policies.
- **[MANDATORY]** Each fitness function links to the ADR or quality attribute it protects, has an owner, and fails the pipeline (or alerts, for runtime checks) with a message explaining the rule and how to fix the violation.
- **[PATTERN]** Adopting rules on an existing codebase: freeze current violations (ArchUnit `FreezingArchRule`, baseline files) so new violations fail while old ones are tracked and reduced over time.
- **[FORBIDDEN]** Architecture rules documented only in wikis or diagrams; if a rule matters and can be automated, it is automated; rules that no longer match the chosen architecture are updated through an ADR rather than silently disabled.
- **[PATTERN]** Runtime (continuous) fitness functions: SLO burn-rate alerts, chaos experiments verifying resilience assumptions, and cost anomaly detection complement build-time checks.
- **[TESTING]** Keep fitness functions fast and deterministic; long-running ones (load tests, chaos) run on schedules or before releases with results tracked as trends.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
