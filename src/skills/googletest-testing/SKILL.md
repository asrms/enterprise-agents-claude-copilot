---
name: googletest-testing
description: "Unit and integration testing for C++ with GoogleTest and GoogleMock (or Catch2): test structure and naming, fixtures, parameterized and typed tests, matchers, mocking through interfaces or templates, death tests, testing time and randomness, CTest integration with gtest_discover_tests, coverage with llvm-cov or gcov, and running tests under sanitizers. Use it when writing or reviewing C++ tests."
---

# Skill: GoogleTest Testing

## Implementation Rules:
- **[PATTERN]** Organize tests by the unit under test with descriptive names (`TEST(OrderTotal, SumsLineTotalsInCents)`), one behavior per test, and the arrange-act-assert structure; use `EXPECT_*` for independent checks and `ASSERT_*` when continuing makes no sense.
- **[PATTERN]** Use test fixtures (`TEST_F`) for shared setup, parameterized tests (`TEST_P` with `INSTANTIATE_TEST_SUITE_P`) for input variations with readable parameter names, and typed tests for generic code.
- **[PATTERN]** Use GoogleMock matchers for expressive assertions (`EXPECT_THAT(v, ElementsAre(...))`, `HasSubstr`, `Field`, `Optional`), which produce clear failure messages.
- **[MANDATORY]** Design for testability: depend on interfaces (abstract classes) or template parameters for external systems (clocks, file systems, network, databases), inject them, and substitute fakes or GoogleMock mocks (`MOCK_METHOD`) in tests.
- **[PATTERN]** Prefer fakes for stateful collaborators and mocks only when the interaction itself is the behavior; use `NiceMock` or `StrictMock` deliberately, and set expectations before exercising the code.
- **[MANDATORY]** Control time and randomness: inject a clock abstraction and seeded random engines instead of calling `std::chrono::system_clock::now()` or `std::random_device` directly in logic.
- **[PATTERN]** Test contract violations with death tests (`EXPECT_DEATH`) only for intended aborts or assertions, and test error results (`std::expected`, error codes, exceptions with `EXPECT_THROW`) for recoverable failures.
- **[FORBIDDEN]** Tests depending on execution order, global mutable state, real network or production services, sleeps for synchronization, and asserting on private implementation details via `#define private public`.
- **[MANDATORY]** Integrate with CMake and CTest (`include(GoogleTest)` and `gtest_discover_tests`), get GoogleTest through the package manager (vcpkg, Conan) or `FetchContent` with a pinned version, and run tests with `ctest` in CI.
- **[PERFORMANCE]** Keep unit tests fast and parallel (`ctest -j`), separate slow integration tests with labels, and shard large suites (`GTEST_TOTAL_SHARDS`, `GTEST_SHARD_INDEX`) when needed.
- **[TESTING]** Run the suite under sanitizers (ASan, UBSan, TSan jobs), measure coverage with llvm-cov or gcov/lcov on changed code, and randomize order (`--gtest_shuffle` with a printed seed) to detect hidden dependencies.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
