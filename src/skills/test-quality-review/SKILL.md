---
name: test-quality-review
description: "Reviewing the quality of tests in any language: behavior over implementation, one reason to fail, Arrange-Act-Assert, meaningful assertions, deterministic time and randomness, proper use of mocks, coverage of edge and error paths, and no flakiness. Use it when reviewing or writing unit, integration, or end-to-end tests."
---

# Skill: Test Quality Review

## Implementation Rules:
- **[MANDATORY]** Tests verify observable behavior through the public API of the unit (return values, state changes visible to callers, calls to outbound ports), never private methods, internal fields, or the order of internal calls.
- **[MANDATORY]** Each test has one reason to fail: a single behavior per test, named after the behavior and the condition (`rejects_refund_when_amount_exceeds_payment`, `shouldReturn404_whenOrderBelongsToAnotherTenant`); names like `test1`, `works`, `testService` are rejected.
- **[PATTERN]** Arrange–Act–Assert (or given/when/then) with visible separation; the Act section is usually one line; setup that is irrelevant to the behavior is hidden in builders/fixtures so the relevant values stand out.
- **[FORBIDDEN]** Assertion-free tests, assertions that cannot fail (`assert result is not None` after a constructor, `assertTrue(true)`), and tests that only check "no exception was thrown" when a result can be verified.
- **[PATTERN]** Assert precisely: exact values, full objects with recursive/structural comparison, specific exception types and messages, HTTP status plus body; avoid `contains`/`greater than 0` when the exact expected value is known.
- **[FORBIDDEN]** Logic in tests: loops, conditionals, and computing the expected value with the same algorithm as the production code; use table-driven/parameterized tests with explicit literal expectations instead.
- **[MANDATORY]** Determinism: time via injected clocks or fake timers, randomness via seeded or injected generators, no dependence on test order, shared mutable state, the machine's locale/time zone, or real network calls in unit tests.
- **[FORBIDDEN]** Sleeping to wait for asynchronous effects (`sleep`, `Thread.sleep`, `setTimeout`, `time.sleep`); use polling assertions with timeouts (Awaitility, `vi.waitFor`, Playwright web-first assertions, `Eventually` in Go testify) or explicit synchronization.
- **[PATTERN]** Mock only what you own and only at boundaries (repositories, gateways, clocks, message publishers); do not mock value objects, DTOs, collections, or the class under test; prefer fakes (in-memory repositories) for complex collaborators.
- **[PATTERN]** Verify interactions only for commands (side effects: save, send, publish), never for queries already stubbed; unused stubs should fail the test where the framework supports it (Mockito strict stubs).
- **[MANDATORY]** Cover what breaks in production: boundary values (0, 1, max, max+1), empty and null inputs, error paths of every dependency, authorization failures, duplicates and retries (idempotency), concurrency where relevant.
- **[PATTERN]** Integration tests use real infrastructure of the same type as production (Testcontainers for databases and brokers, WireMock/MSW for HTTP) instead of in-memory substitutes with different semantics (H2 for PostgreSQL, fake SQL dialects).
- **[FORBIDDEN]** Large snapshot tests of whole pages, responses, or objects as the main assertion: they get updated without review; use small inline snapshots of stable output or explicit assertions.
- **[PATTERN]** Test data: builders/factories with sensible defaults (`anOrder().withStatus(SHIPPED).build()`), unique identifiers per test to allow parallel runs, and cleanup through transactions or isolated schemas.
- **[TESTING]** A test must fail for the right reason: when reviewing a new test for a bug fix, check (or ask) that it fails on the code before the fix; mutation testing reports on critical modules show whether assertions are strong enough.
- **[PERFORMANCE]** Unit suites run in seconds and in parallel; slow tests are moved to a separate integration stage rather than deleted; tests that are skipped or quarantined carry a ticket and an owner.
- **[CONFIGURATION]** CI fails on focused or disabled tests committed by mistake (`.only`, `fit`, `@Disabled` without reason) through lint rules, and publishes test reports and coverage diff on the PR.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
