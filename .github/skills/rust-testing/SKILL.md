---
name: rust-testing
description: "Testing Rust crates and services: unit tests in modules, integration tests in tests/, doc tests, table-driven tests, property-based testing with proptest, snapshot testing with insta, mocking with traits and mockall, async tests, Testcontainers, fuzzing with cargo fuzz, coverage with cargo-llvm-cov, and fast CI with cargo nextest. Use it when writing or reviewing tests for Rust code."
---

# Skill: Rust Testing

## Implementation Rules:
- **[PATTERN]** Place unit tests next to the code in `#[cfg(test)] mod tests` (with access to private items), integration tests of the public API in `tests/`, and runnable examples as doc tests in `///` comments so documentation stays correct.
- **[PATTERN]** Write table-driven tests with arrays of cases or the `rstest` crate (`#[rstest]` with `#[case]`) for input variations, with descriptive case names and assertion messages.
- **[MANDATORY]** Test error paths as well as success: assert on error variants with `matches!`, and test that invalid inputs are rejected by constructors of validated types.
- **[PATTERN]** Use property-based testing with `proptest` (or `quickcheck`) for parsers, encoders, and algorithms: round-trip properties (`decode(encode(x)) == x`), invariants, and shrinking to minimal failing inputs; commit regression files for found failures.
- **[PATTERN]** Use snapshot testing with `insta` for complex outputs (rendered text, serialized structures, error messages), reviewing changes with `cargo insta review` and redacting volatile fields.
- **[PATTERN]** Isolate dependencies through traits: define small traits for external systems, implement fakes for tests, and use `mockall` only where interaction verification is needed; avoid mocking concrete types.
- **[MANDATORY]** Test async code with `#[tokio::test]` (paused time with `start_paused = true` for time-dependent logic) and integration tests against real services with Testcontainers (`testcontainers` crate) or `sqlx::test` with a real database.
- **[FORBIDDEN]** Tests that depend on execution order or shared global state (tests run in parallel by default), `thread::sleep` for synchronization, ignoring failing tests with `#[ignore]` without an issue link, and tests that require network access to external services.
- **[PATTERN]** Fuzz code that handles untrusted input (parsers, decoders, protocol handlers) with `cargo fuzz` (libFuzzer) or `cargo-afl`, run regularly in CI or on a schedule, adding crashing inputs to the regression corpus.
- **[PERFORMANCE]** Run tests with `cargo nextest` for faster, isolated execution and clearer output, and share expensive fixtures (containers) across tests where safe.
- **[TESTING]** CI runs `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo nextest run --all-features` plus `cargo test --doc`, coverage with `cargo llvm-cov` and thresholds on critical crates, and Miri for crates with unsafe code.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
