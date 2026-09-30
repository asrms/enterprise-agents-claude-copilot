---
name: complexity-metrics
description: "Measuring and controlling code complexity in any language: cyclomatic and cognitive complexity, nesting depth, function and file size, coupling and churn hotspots, duplication, and quality gates on new code with SonarQube and linters. Use it when assessing maintainability, setting quality gates, or prioritizing refactoring."
---

# Skill: Complexity Metrics

## Implementation Rules:
- **[PATTERN]** Use cognitive complexity (SonarSource definition) as the primary readability metric for functions, with cyclomatic complexity as the testability metric (it is the minimum number of test cases to cover every independent path).
- **[CONFIGURATION]** Default thresholds per function: cognitive complexity ≤ 15, cyclomatic complexity ≤ 10, nesting depth ≤ 3, length ≤ ~50 lines, parameters ≤ 4; per file/class: ≤ ~400 lines; exceptions are justified in the code review and suppressed locally with a reason, never globally.
- **[CONFIGURATION]** Enforce thresholds with the ecosystem linter: ESLint `complexity`, `max-depth`, `max-params`, `max-lines-per-function` and `sonarjs/cognitive-complexity`; Ruff `C901` (mccabe) and `PLR0912`/`PLR0913`/`PLR0915`; golangci-lint `gocyclo`, `gocognit`, `funlen`, `nestif`; Checkstyle/PMD `CyclomaticComplexity`, `CognitiveComplexity`, `NPathComplexity`; .NET analyzers `CA1502`/`CA1505`.
- **[MANDATORY]** Quality gates apply to new and changed code ("clean as you code"): the build fails if new code introduces functions above the thresholds, duplication above 3% on new lines, or coverage on new code below the agreed level (e.g. 80%); legacy debt is tracked but does not block unrelated changes.
- **[PATTERN]** Find hotspots by combining complexity with change frequency (churn): files that are both complex and frequently modified are the refactoring priority; complex but stable code is lower priority (`git log --format=format: --name-only | sort | uniq -c | sort -rn` combined with complexity reports, or tools like CodeScene).
- **[PATTERN]** Coupling metrics at module level: afferent/efferent coupling, instability, and dependency cycles; cycles between packages/modules are architecture defects and are blocked with architecture tests (ArchUnit, dependency-cruiser, import-linter, go `depguard`).
- **[PATTERN]** Duplication: detect with jscpd, PMD CPD, or SonarQube (≥ ~100 tokens or 10 lines); duplicated business rules are consolidated, while duplicated test setup is better handled with builders than with abstraction in production code.
- **[FORBIDDEN]** Gaming metrics: splitting a function into meaningless fragments to lower complexity, excluding files from analysis to pass the gate, writing assertion-free tests to raise coverage; reviewers treat these as `major` findings.
- **[PATTERN]** Reduce complexity with targeted refactorings: guard clauses instead of nested `if`, lookup tables or polymorphism instead of long `switch`/`if` chains, extraction of well-named predicates (`isEligibleForDiscount(order)`), and splitting phases (parse → validate → compute).
- **[PATTERN]** Report metrics as trends, not snapshots: track complexity, duplication, and coverage over time per module in the quality dashboard; a sudden increase in a PR is discussed in review.
- **[ARCHITECTURE]** Complexity budgets per layer: domain logic can be algorithmically complex but must be pure and well tested; controllers/handlers and adapters should stay close to trivial (cognitive complexity ≤ 5) because they are hard to test in isolation.
- **[CONFIGURATION]** SonarQube/SonarCloud project setup: quality profile with cognitive complexity and duplication rules enabled, quality gate on new code (`new_coverage`, `new_duplicated_lines_density`, `new_maintainability_rating = A`), and the PR decoration enabled so findings appear in the review.
- **[TESTING]** Functions with cyclomatic complexity N need at least N meaningful test cases; when complexity cannot be reduced (parsers, state machines, pricing tables), compensate with table-driven or property-based tests.
- **[PERFORMANCE]** Keep analysis fast in CI: run linters on changed files in pre-commit/PR jobs and the full analysis on the main branch nightly or on merge.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
