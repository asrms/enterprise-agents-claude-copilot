---
name: go-testing
description: "Testing Go code with the standard testing package: table-driven tests with subtests, t.Helper and t.Cleanup, fakes over mocks, httptest, Testcontainers for databases, golden files, fuzzing, race detection, synctest for time, and coverage in CI. Use it when writing or reviewing Go tests."
---

# Skill: Go Testing

## Implementation Rules:
- **[PATTERN]** Use table-driven tests with named cases and subtests (`t.Run(tc.name, ...)`), with inputs and expected outputs (including expected errors checked with `errors.Is`) in the table; call `t.Parallel()` where tests are independent.
- **[PATTERN]** Test helpers call `t.Helper()`, fail with clear messages showing got and want (`t.Errorf("Total() = %v, want %v", got, want)`), and register cleanup with `t.Cleanup` instead of manual `defer` chains; use `github.com/google/go-cmp/cmp` for structural diffs.
- **[PATTERN]** Prefer hand-written fakes that implement small consumer interfaces over generated mocks; use mocks (`go.uber.org/mock`) only to verify interactions that matter, not every call.
- **[MANDATORY]** Test HTTP handlers with `httptest.NewRecorder` or `httptest.NewServer` through the real router and middleware, and outbound clients against an `httptest.Server` that simulates success, errors, and slow responses.
- **[MANDATORY]** Repository and integration tests run against the real engine using Testcontainers for Go (`testcontainers-go/modules/postgres`) with migrations applied, separated with build tags (`//go:build integration`) or `testing.Short()` so unit tests stay fast.
- **[PATTERN]** Use golden files under `testdata/` for large outputs (rendered documents, generated code, API responses) with an `-update` flag to regenerate them intentionally, and review golden diffs in pull requests.
- **[PATTERN]** Fuzz parsers, decoders, and validation functions with native fuzzing (`func FuzzX(f *testing.F)`), seeding the corpus with representative inputs and committing crashing inputs found under `testdata/fuzz`.
- **[MANDATORY]** Control time and concurrency: inject clocks (`func() time.Time`) or use `testing/synctest` for code with timers and goroutines; never rely on `time.Sleep` for synchronization in tests.
- **[FORBIDDEN]** Tests that depend on execution order, global state, the network or external services outside containers, and assertions libraries that hide failures behind panics in goroutines (call `t.Fatal` only from the test goroutine).
- **[PERFORMANCE]** Keep unit tests fast (whole package in seconds); share expensive containers across a package with `TestMain`, and isolate data per test with unique ids or transactions.
- **[TESTING]** CI runs `go test -race -shuffle=on -coverprofile=cover.out ./...`, integration tests with the `integration` tag, fuzz tests for a bounded time on schedule, and enforces coverage thresholds on critical packages.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
