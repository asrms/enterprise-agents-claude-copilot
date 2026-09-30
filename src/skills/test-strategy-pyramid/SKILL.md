---
name: test-strategy-pyramid
description: "Designing a test strategy for any product: test pyramid/trophy balance, what to test at each level (unit, component, integration, contract, end-to-end, exploratory), risk-based prioritization, CI stages and time budgets, coverage policy, and a written test plan. Use it when defining or reviewing how a system is tested."
---

# Skill: Test Strategy and Pyramid

## Implementation Rules:
- **[ARCHITECTURE]** Define the strategy per system as a written, versioned document (`docs/testing-strategy.md`): scope, risks, test levels and their responsibilities, tools, environments, data, CI stages, entry/exit criteria, and ownership.
- **[PATTERN]** Balance the levels as a pyramid: many fast unit tests for domain logic, fewer integration/component tests for adapters and wiring, a small set of end-to-end tests for critical user journeys; for UI-heavy frontends the "testing trophy" (more integration/component tests with real DOM rendering) is acceptable.
- **[MANDATORY]** Assign each risk to the cheapest level that can detect it: business rules → unit; SQL, serialization, framework configuration → integration with real dependencies (Testcontainers); service-to-service agreements → consumer-driven contract tests; user journeys across services → end-to-end; usability and unknown unknowns → exploratory testing.
- **[FORBIDDEN]** The "ice-cream cone" (mostly manual and UI tests, few unit tests) and duplicating the same assertion at every level; an end-to-end test does not re-verify every business rule already covered by unit tests.
- **[PATTERN]** Risk-based prioritization: rank features by business impact × likelihood of failure (money, security, data integrity, legal/compliance, high-traffic paths) and invest in depth there; low-risk internal tooling gets lighter coverage.
- **[MANDATORY]** Non-functional testing is part of the strategy, not an afterthought: performance/load (k6, Gatling, JMeter), security (SAST, DAST, dependency scanning), accessibility (axe, manual screen reader checks), resilience (fault injection), and compatibility (browsers/devices) each have an owner, a tool, and a trigger.
- **[CONFIGURATION]** CI stages with time budgets: pre-commit/PR fast stage (lint, types, unit, component) under ~10 minutes; integration and contract tests on every PR in parallel; end-to-end smoke on every deploy to a test environment; full regression, performance, and DAST nightly or before release.
- **[PATTERN]** Coverage policy: coverage is a signal, not a goal; enforce thresholds on new code (e.g. ≥ 80% lines and branches on domain modules), report the trend, and use mutation testing on critical modules to verify assertion strength.
- **[PATTERN]** Test environments: ephemeral per-PR environments or containerized dependencies instead of shared long-lived test environments; production-like configuration and data shape; infrastructure defined as code.
- **[MANDATORY]** Entry and exit criteria per release: all automated suites green, no open blocker/critical defects, performance within budget, accessibility checks passed for changed flows, known issues documented with workarounds.
- **[PATTERN]** Shift left and shift right: tests are written with the code (TDD or test-with-code in the same PR), acceptance criteria are expressed as examples before development; in production, synthetic monitoring, canary analysis, and feature flags complement pre-release testing.
- **[PATTERN]** Exploratory testing sessions are time-boxed with a charter ("explore refund flows with partial shipments to discover rounding issues") and their findings are turned into automated regression tests when reproducible.
- **[TESTING]** Track quality metrics that drive decisions: escaped defects per release and the level that should have caught them, flaky test rate, suite duration, mean time to detect; review them each quarter and adjust the strategy.
- **[FORBIDDEN]** Manual regression checklists for behavior that can be automated, and releases blocked by long manual test phases; manual effort is reserved for exploration, usability, and one-off verification.
- **[SECURITY]** Test data and environments never contain real personal data unless anonymized or synthetic; credentials for test environments are separate from production and stored in the CI secret store.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
