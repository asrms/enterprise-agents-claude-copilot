---
name: flaky-test-prevention
description: "Preventing, detecting, and fixing flaky tests in any language: common root causes (timing, order dependence, shared state, time zones, randomness, network, resource leaks), detection by reruns and CI analytics, quarantine policy with ownership, and deterministic test design. Use it when a test fails intermittently or when hardening a test suite."
---

# Skill: Flaky Test Prevention

## Implementation Rules:
- **[MANDATORY]** Treat a flaky test as a bug with an owner and a deadline: it erodes trust in the whole suite; the options are fix, rewrite at a lower level, or delete, never "rerun until green".
- **[PATTERN]** Classify the root cause before fixing; the most common causes are: asynchronous waits, test order dependence, shared mutable state (static fields, singletons, shared DB rows, caches), time and time zones, unseeded randomness, real network or third-party calls, resource leaks (ports, files, threads), concurrency in the code under test, and environment differences.
- **[FORBIDDEN]** Fixed sleeps as synchronization and increasing timeouts as a fix; wait for a condition with polling assertions (Awaitility, `vi.waitFor`, Playwright web-first assertions, testify `Eventually`, `WaitUntil`) or use explicit signals (latches, channels, events).
- **[MANDATORY]** Control time and randomness: inject clocks, use fake timers, fix the time zone (`TZ=UTC`) and locale in CI, seed random generators and print the seed on failure.
- **[PATTERN]** Detect order dependence by running tests in random order (JUnit `MethodOrderer.Random`, pytest-randomly, Vitest `sequence.shuffle`, Go `-shuffle=on`, xUnit collection randomization) and by running each test in isolation.
- **[PATTERN]** Detect flakiness proactively: rerun new or modified tests multiple times in CI (`--repeat-each` in Playwright, `-count=N` in Go, `pytest --count` with pytest-repeat, JUnit `@RepeatedTest` locally), and collect per-test pass/fail history in CI analytics (test report tools, Develocity, Buildkite/GitHub test analytics).
- **[MANDATORY]** Quarantine policy: a confirmed flaky test is moved to a quarantine job or tagged (`@Tag("quarantine")`, `test.fixme`, `pytest.mark.quarantine`) within a day, with a ticket, an owner, and an expiry (e.g. two weeks), after which it is fixed or deleted; the main pipeline stays reliable.
- **[FORBIDDEN]** Automatic retries that hide flakiness: retries in CI (e.g. Playwright `retries: 2`) are acceptable only if tests passing on retry are reported as flaky and tracked, never counted as simply passed.
- **[PATTERN]** Isolate state: fresh database state per test (transactions, truncation, per-worker schemas), unique resource names, dynamic ports (`0`/random), temporary directories per test, reset of global singletons and environment variables after each test.
- **[PATTERN]** Remove real external dependencies from unit and integration tests: stub HTTP with WireMock/MSW/respx/httptest, use Testcontainers for infrastructure with health-check-based readiness instead of fixed delays.
- **[PATTERN]** Concurrency flakiness often reveals real bugs: run the code under the race detector (`go test -race`), thread sanitizers, or stress loops before assuming the test is at fault.
- **[PERFORMANCE]** Resource exhaustion causes flakiness under parallelism: close clients, pools, and servers in teardown; size worker count to CI machine resources; set explicit memory/CPU limits for containers used in tests.
- **[CONFIGURATION]** CI environment parity: pinned tool and browser versions, same container image locally and in CI, explicit `TZ`, `LANG`, and screen size for UI tests.
- **[TESTING]** A fix is verified by running the test many times (e.g. 100 repetitions or `--repeat-each=50`) on CI-like hardware, including under parallel load, before closing the ticket.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
