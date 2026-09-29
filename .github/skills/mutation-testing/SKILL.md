---
name: mutation-testing
description: "Measuring test effectiveness with mutation testing: PIT (Java/Kotlin), Stryker (JavaScript/TypeScript, C#), mutmut/cosmic-ray (Python), go-mutesting (Go); mutation score thresholds, incremental analysis on changed code, handling equivalent mutants, and killing surviving mutants with better assertions. Use it to evaluate whether tests would actually catch bugs."
---

# Skill: Mutation Testing

## Implementation Rules:
- **[ARCHITECTURE]** Use mutation testing to measure the fault-detection power of tests on critical modules (pricing, authorization, state machines, parsers); line coverage only shows code was executed, mutation score shows tests would fail if the code were wrong.
- **[CONFIGURATION]** Tools per ecosystem: PIT with `pitest-maven`/`gradle-pitest-plugin` and the JUnit 5 plugin (Java/Kotlin), StrykerJS with the Vitest/Jest runner and Stryker.NET (JS/TS, C#), mutmut or cosmic-ray (Python), go-mutesting or Gremlins (Go), cargo-mutants (Rust), Infection (PHP).
- **[PERFORMANCE]** Scope mutation runs: target domain and application packages (`targetClasses`, `mutate` globs), exclude generated code, DTOs, configuration, and logging; run incrementally on changed files in PRs (PIT history files/`scmMutationCoverage`, Stryker `--incremental` or `--since`) and the full run nightly.
- **[MANDATORY]** Set thresholds on the targeted scope: e.g. mutation score ≥ 70–80% for critical domain modules (`mutationThreshold` in PIT, `thresholds.break` in Stryker), with the build failing below `break`; start from the current baseline and raise it gradually.
- **[PATTERN]** Analyze surviving mutants one by one: each survivor is either a missing or weak assertion (add a test or strengthen the assertion), untested behavior (add a case, often a boundary), dead or redundant code (remove it), or an equivalent mutant (document and exclude).
- **[PATTERN]** Typical survivors and their fixes: conditional boundary (`<` → `<=`) → add tests exactly at the boundary; negated conditional → test both branches with distinguishing assertions; removed method call (void side effect) → verify the side effect; return value replaced → assert on the returned value, not just its presence.
- **[FORBIDDEN]** Raising the score by testing implementation details, by asserting on log output, or by excluding hard-to-kill code from the scope without a documented reason.
- **[PATTERN]** Equivalent mutants (mutations that do not change behavior, e.g. in logging or in `i < n` vs `i != n` loops) are marked with the tool's suppression mechanism (Stryker `// Stryker disable next-line <mutator>: reason`, PIT `excludedMethods`/avoidCallsTo) including the reason.
- **[TESTING]** Tests used by mutation runs must be deterministic and fast; flaky tests produce false "killed" or "timed out" results, so fix flakiness before trusting mutation scores.
- **[CONFIGURATION]** Publish HTML reports as CI artifacts and, where supported, to a dashboard (Stryker Dashboard, Sonar via PIT/Stryker reports) so reviewers can inspect survivors in PRs.
- **[PATTERN]** Use mutation results in code review: when a PR adds logic to a critical module, reviewers check the incremental mutation report for new survivors in the changed lines.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
