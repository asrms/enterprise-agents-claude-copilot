---
name: node-testing-supertest
description: "Testing Node.js/TypeScript backends with Vitest or Jest, Supertest or fastify.inject, Testcontainers, and MSW or nock: unit tests for domain logic, in-process HTTP integration tests, real databases in containers, mocked external HTTP, fake timers, and coverage gates. Use it when writing or reviewing tests for Node.js services."
---

# Skill: Node.js Testing with Supertest

## Implementation Rules:
- **[ARCHITECTURE]** Follow the test pyramid: many fast unit tests for domain logic and services, integration tests for HTTP routes and repositories against real infrastructure, and a few end-to-end tests; each level has its own command (`test:unit`, `test:integration`).
- **[MANDATORY]** Export the application factory separately from `listen()` (`buildApp()`/`createApp()`), so tests exercise the full HTTP pipeline in-process with Supertest (`request(app)`) or `fastify.inject()` without binding ports.
- **[MANDATORY]** Integration tests use real dependencies of the same engine and version as production through Testcontainers (PostgreSQL, Redis, Kafka, LocalStack), with migrations applied; in-memory substitutes such as SQLite for PostgreSQL are not acceptable for repository tests.
- **[PATTERN]** Mock only at the process boundary: external HTTP APIs with MSW (`setupServer`) or nock with `disableNetConnect()`, so unexpected outbound calls fail the test; do not mock your own modules deeply or the ORM in integration tests.
- **[PATTERN]** Tests are isolated and order-independent: each test creates its own data (factories/builders with unique ids), cleans up via transaction rollback or truncation, and never depends on data left by another test.
- **[PATTERN]** Assert behavior and contracts: status codes, response bodies validated against the API schema, headers (security headers, `Location`, `Content-Type: application/problem+json`), and persisted side effects; not implementation details or snapshot dumps of large objects.
- **[MANDATORY]** Cover the unhappy paths for every route: validation errors (400/422), unauthenticated (401), forbidden and cross-tenant access (403/404), not found, conflict, and dependency failures or timeouts.
- **[PATTERN]** Control time and randomness: `vi.useFakeTimers()`/`jest.useFakeTimers()` or an injected clock for time-dependent logic, seeded or injected id generators; never `setTimeout` sleeps to wait for async work (poll with `vi.waitFor` or await the event).
- **[PERFORMANCE]** Keep the suite fast: start containers once per test run (global setup) and reuse them, run test files in parallel with isolated schemas or databases, and keep unit tests free of I/O.
- **[FORBIDDEN]** Tests that hit shared or production environments, `.only`/`.skip` committed to the main branch (enforced by lint), and assertions inside `try/catch` blocks that swallow failures.
- **[TESTING]** CI runs type checking, linting, unit and integration tests with coverage thresholds on changed code (for example 80% lines and branches via `vitest --coverage`), and publishes JUnit reports.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
