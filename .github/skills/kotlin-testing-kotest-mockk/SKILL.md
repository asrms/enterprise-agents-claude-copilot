---
name: kotlin-testing-kotest-mockk
description: "Testing Kotlin code with Kotest and MockK (or JUnit 5): spec styles, expressive matchers, data-driven and property-based tests, coroutine tests with runTest and virtual time, MockK for mocks, spies, coEvery and relaxed mocks used sparingly, fakes for ports, Testcontainers extensions, and test organization. Use it when writing or reviewing tests for Kotlin backends and libraries."
---

# Skill: Kotlin Testing with Kotest and MockK

## Implementation Rules:
- **[PATTERN]** Choose one test framework per project and use it consistently: Kotest (with a spec style such as `FunSpec` or `BehaviorSpec`) or JUnit 5 with Kotlin-friendly assertions; both run on the JUnit Platform in Gradle.
- **[PATTERN]** Name tests by behavior and structure them clearly (Given/When/Then or arrange-act-assert), one behavior per test, with Kotest matchers (`shouldBe`, `shouldContainExactly`, `shouldThrow<T>`) or AssertJ/Strikt for readable failures.
- **[PATTERN]** Use data-driven tests for variations (`withData` in Kotest, `@ParameterizedTest` in JUnit) and property-based tests (`checkAll` with `Arb` generators) for invariants of parsers, calculations, and value classes.
- **[MANDATORY]** Test coroutines with `kotlinx-coroutines-test` (`runTest`, `StandardTestDispatcher`, `advanceTimeBy`) or Kotest's coroutine support, injecting dispatchers and clocks; never rely on real delays.
- **[PATTERN]** Prefer hand-written fakes for your own ports (in-memory repositories) and use MockK for interactions with boundaries: `every`/`coEvery` for stubbing suspend functions, `verify`/`coVerify` only where the interaction is the behavior under test, and `slot` or `capture` to inspect arguments.
- **[FORBIDDEN]** Relaxed mocks as a default (they hide missing stubs), mocking data classes or value objects, verifying every call (brittle tests), `Thread.sleep` in tests, and shared mutable state between specs without isolation.
- **[MANDATORY]** Integration tests use real infrastructure through Testcontainers (Kotest extension or JUnit `@Testcontainers`), with migrations applied and data isolated per test.
- **[PATTERN]** Configure isolation deliberately (Kotest `isolationMode`, fresh fixtures per test), and use `beforeTest`/`afterTest` or `@BeforeEach` for setup rather than order-dependent tests.
- **[PATTERN]** Keep test fixtures readable with builder functions and default arguments (`order(status = PAID)`), and use object mothers sparingly.
- **[PERFORMANCE]** Keep unit tests fast and parallelizable (Kotest `parallelism`, JUnit parallel execution), sharing expensive containers per test run.
- **[TESTING]** CI runs `./gradlew test` (and integration tasks) with coverage via Kover and thresholds on changed modules, publishing JUnit XML reports.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
