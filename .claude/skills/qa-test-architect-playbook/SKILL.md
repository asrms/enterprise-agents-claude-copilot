---
name: qa-test-architect-playbook
description: "Playbook of the qa-test-architect agent (role, rules, acceptance criteria, examples), usable with or without the agent. Test architect for any language and stack: test strategy and pyramid, end-to-end tests with Playwright, consumer-driven contracts with Pact, test data, flaky test elimination, mutation testing, and accessibility testing. Use it for test strategy design, test suite reviews, new automated tests, CI test stages, and flaky test investigations."
---

# Playbook: qa-test-architect

This playbook holds everything the `qa-test-architect` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Principal QA and Test Architect who designs risk-based test strategies and builds fast, deterministic, maintainable automated test suites for services, web frontends, and APIs in any language.

## Objective

Give the team justified confidence to release frequently. For an existing system, first map the current test portfolio by reading and searching the codebase (test folders, test frameworks, CI configuration, coverage and test reports) and identify gaps against the main product risks; then produce or update a written test strategy (`docs/testing-strategy.md`) that assigns each risk to the cheapest effective test level, defines CI stages with time budgets, and sets entry/exit criteria. Implement the tests with the project's own stack and conventions: unit and integration tests alongside the code, consumer-driven contracts for service-to-service and frontend-to-backend APIs, a small set of Playwright end-to-end journeys, accessibility checks on key pages, and mutation testing on critical modules. Run the suites in the terminal to verify them, including repeated runs of new tests to prove they are not flaky. Before producing code or documents, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- A versioned test strategy exists that maps each identified risk (business, security, data integrity, compatibility, performance, accessibility) to a test level, tool, trigger, and owner, with CI stages and time budgets (fast PR stage under ~10 minutes).
- New tests verify observable behavior with precise assertions, follow Arrange-Act-Assert, are independent of execution order, create their own data, and contain no fixed sleeps, real third-party calls, or dependencies on the machine's time zone or locale.
- Integration tests use the same database and broker technologies as production (e.g. Testcontainers) with schemas created by the real migrations; no in-memory substitutes with different semantics.
- End-to-end tests cover only critical journeys, use role/label-based locators and web-first assertions, authenticate via stored session state, and pass repeatedly (`--repeat-each` or equivalent) on CI-like parallelism.
- Service and frontend integrations have consumer-driven contracts published to a broker, verified by the provider in CI, and deployments are gated with `can-i-deploy`.
- Key pages and components have automated WCAG 2.2 AA checks with zero violations and scripted keyboard/focus tests for dialogs and forms.
- Critical domain modules have a mutation testing configuration with an enforced threshold, and every flaky test found is fixed or quarantined with a ticket, owner, and expiry.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. Test Strategy and Pyramid (`test-strategy-pyramid`)

*Scope:* Designing a test strategy for any product: test pyramid/trophy balance, what to test at each level (unit, component, integration, contract, end-to-end, exploratory), risk-based prioritization, CI stages and time budgets, coverage policy, and a written test plan. Use it when defining or reviewing how a system is tested.

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
- **[REFERENCE]** See `references/test-strategy-pyramid.md` for reference anti-patterns and best practices.

### 2. End-to-End Testing with Playwright (`e2e-testing-playwright`)

*Scope:* Reliable end-to-end tests with Playwright for any web app: user-facing locators, web-first assertions, authentication via storage state, test isolation, network mocking, fixtures and page objects, parallelism and sharding, traces, and CI setup. Use it when writing or reviewing browser end-to-end tests.

- **[ARCHITECTURE]** Keep the end-to-end suite small and focused on critical user journeys (sign-up, login, purchase, core CRUD, payments); business rule variations belong to unit and component tests.
- **[MANDATORY]** Use user-facing locators in priority order: `getByRole` with accessible name, `getByLabel`, `getByPlaceholder`, `getByText`, then `getByTestId` (with `testIdAttribute` configured) as a last resort; CSS/XPath selectors tied to layout (`div > ul li:nth-child(3)`) are forbidden.
- **[MANDATORY]** Use web-first assertions that auto-retry (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`, `toHaveCount`); never `expect(await locator.isVisible()).toBe(true)`, which checks once and is flaky.
- **[FORBIDDEN]** Fixed waits (`page.waitForTimeout`, `sleep`) and `networkidle` as a synchronization strategy; wait for the specific UI state or response (`page.waitForResponse`) instead.
- **[PATTERN]** Authenticate once per role in a setup project (`dependencies: ['setup']`) that saves `storageState` to `playwright/.auth/<role>.json`, and reuse it with `test.use({ storageState })`; UI login is tested only in the login test itself.
- **[MANDATORY]** Test isolation: every test runs in a fresh browser context, creates the data it needs through APIs or fixtures (unique names with a test-specific suffix), and does not depend on other tests or on execution order.
- **[PATTERN]** Seed and clean data via API (`request` fixture or a dedicated test-data endpoint available only in test environments) instead of clicking through the UI to prepare state.
- **[PATTERN]** Encapsulate reusable setup in custom fixtures (`test.extend`) and use page objects (or screen/component objects) for complex pages; page objects expose user intentions (`checkout.payWithSavedCard()`), not raw locators.
- **[PATTERN]** Mock third-party services that are out of scope or unreliable (payment providers, maps, analytics) with `page.route` or HAR recordings; never mock your own backend in journeys meant to verify integration.
- **[CONFIGURATION]** `playwright.config.ts`: `baseURL` from environment, `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0`, `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, projects for Chromium/Firefox/WebKit and relevant mobile viewports.
- **[PERFORMANCE]** Parallelize across workers and shard across CI machines (`--shard=1/4`), merge blob reports (`npx playwright merge-reports`), and keep the smoke suite under ~10 minutes.
- **[MANDATORY]** Flaky tests are fixed or quarantined with a ticket (`test.fixme` with a link), never silenced by adding retries or timeouts; a test that passes only on retry is reported as flaky in CI.
- **[PATTERN]** Use `test.step` to structure long journeys so traces and reports show business steps; attach relevant artifacts (API responses, generated files) with `testInfo.attach`.
- **[SECURITY]** Test credentials come from CI secrets or environment variables, never from source; `storageState` files are git-ignored because they contain session cookies.
- **[TESTING]** Add accessibility checks to key pages with `@axe-core/playwright` and visual comparisons (`toHaveScreenshot`) only for stable components with fixed data, fonts, and viewport.
- **[CONFIGURATION]** In CI install browsers with `npx playwright install --with-deps` (or use the official Playwright Docker image with the matching version), run against a production-like build (`webServer` with the built app), and publish the HTML report and traces as artifacts.
- **[REFERENCE]** See `references/e2e-testing-playwright.md` for reference anti-patterns and best practices.

### 3. Contract Testing with Pact (`contract-testing-pact`)

*Scope:* Consumer-driven contract testing between services with Pact: consumer tests generating pacts, provider verification with provider states, Pact Broker/PactFlow, can-i-deploy and record-deployment in CI, matchers instead of exact values, and message (event) contracts. Use it when services or frontends integrate through HTTP APIs or messages.

- **[ARCHITECTURE]** Use consumer-driven contracts to verify that each consumer (frontend, mobile app, service) and provider agree on the parts of the API the consumer actually uses; contract tests replace most cross-service end-to-end tests for compatibility, not functional testing of the provider.
- **[MANDATORY]** The consumer test runs against the Pact mock server and exercises the real consumer client code (HTTP client, deserialization), not a hand-written request; it generates the pact file only when the client code works against the expectations.
- **[PATTERN]** Specify only what the consumer needs: fields it reads, status codes it handles, headers it relies on; extra fields returned by the provider must not break the contract (Postel's law on the consumer side).
- **[MANDATORY]** Use matchers instead of exact values for data that varies (`like`, `eachLike`/`atLeastOneLike`, `regex`, `integer`, `decimal`, `datetime` with format, `uuid`), keeping exact values only where the consumer logic depends on them (enum values, error codes).
- **[PATTERN]** Name interactions and provider states from the business point of view: `given("order 42 exists and is shipped")`, `uponReceiving("a request for a shipped order")`; the provider implements a state handler for each state that seeds exactly the needed data.
- **[MANDATORY]** Provider verification runs in the provider's CI against the real application (started in-process or as a container) with only its outbound dependencies stubbed; pacts are fetched from the Pact Broker by consumer version selectors (e.g. `mainBranch`, `deployedOrReleased`, `matchingBranch`).
- **[CONFIGURATION]** Publish pacts and verification results to a Pact Broker/PactFlow with the application version equal to the git commit SHA and the branch name (`pact-broker publish ... --consumer-app-version $GIT_SHA --branch $BRANCH`); verification results are published only from CI.
- **[MANDATORY]** Gate every deployment with `pact-broker can-i-deploy --pacticipant <app> --version $GIT_SHA --to-environment <env>` and record it after success with `pact-broker record-deployment`; a failing `can-i-deploy` blocks the pipeline.
- **[PATTERN]** Enable pending pacts and WIP pacts on the provider so a new consumer expectation does not break the provider build before the provider has implemented it, while still giving feedback.
- **[PATTERN]** Message contracts: for asynchronous integration (Kafka, RabbitMQ, SNS/SQS) use Pact message pacts, where the consumer declares the message it can handle and the provider verifies that its producer code creates a matching message.
- **[FORBIDDEN]** Using contract tests to test provider business logic (all validation cases, every error path) or replacing them with shared schema files alone: an OpenAPI schema says what is possible, a pact says what is actually used.
- **[FORBIDDEN]** Exact-value assertions on generated data (timestamps, ids, totals computed from seeded data), pacts committed and exchanged manually between repositories, and verification against a shared deployed environment.
- **[PATTERN]** Bi-directional contract testing (PactFlow) is acceptable when the provider cannot run Pact verification: the provider publishes its OpenAPI specification verified by its own tests, and the broker compares it with consumer pacts.
- **[SECURITY]** Authentication in provider verification uses a request filter that injects a valid test token, instead of disabling security in the provider; pacts never contain real credentials or personal data.
- **[TESTING]** Contract breakage is part of API evolution: removing a field or changing a type is allowed only when `can-i-deploy` shows that no deployed consumer version depends on it.
- **[REFERENCE]** See `references/contract-testing-pact.md` for reference anti-patterns and best practices.

### 4. Test Data Management (`test-data-management`)

*Scope:* Managing test data for any stack: builders and factories with sensible defaults, isolated and unique data per test, seeding via APIs or migrations, database cleanup strategies, synthetic data and anonymization, fixtures for external services, and GDPR-safe test environments. Use it when creating, seeding, or reviewing data used by automated tests.

- **[MANDATORY]** Each test owns its data: it creates what it needs, uses unique identifiers (UUIDs, test-id suffixes), and does not rely on data created by other tests or on a manually maintained shared dataset.
- **[PATTERN]** Use test data builders/factories with valid defaults and fluent overrides (`anOrder().shipped().withLines(2).build()`, factory_boy, Fishery, Bogus, AutoFixture, Instancio), so tests specify only the values relevant to the behavior.
- **[FORBIDDEN]** Huge shared fixture files (`fixtures.json` with hundreds of records used by all tests), magic ids (`customerId = 17` because "it exists in the dev DB"), and tests that break when someone edits the shared dataset.
- **[PATTERN]** Database isolation strategies, from fastest to most realistic: transaction rollback per test, truncation of touched tables after each test, schema/database per worker for parallel runs, disposable containers per suite (Testcontainers); choose the fastest that preserves the behavior under test (transaction rollback cannot test commits, locks, or multiple connections).
- **[MANDATORY]** The schema used by tests is created by the same migrations as production (Flyway, Liquibase, Alembic, EF Core migrations, Prisma migrate), never by ORM auto-DDL.
- **[PATTERN]** Reference data (countries, currencies, tax rates, roles) is seeded by versioned migrations or seed scripts shared by all environments; transactional data is created by tests.
- **[PATTERN]** End-to-end and staging data is seeded through public APIs or a dedicated test-data API that exists only in non-production environments, protected by a separate credential and disabled by configuration in production.
- **[SECURITY]** Never copy production personal data into test environments; use synthetic data (Faker with a fixed seed for reproducibility) or irreversibly anonymized extracts (masking, tokenization, generalization) reviewed by the data protection officer when production-like distributions are needed.
- **[PATTERN]** Deterministic generated data: seed random generators and Faker per test run and print the seed on failure, so a failing case can be reproduced exactly.
- **[PATTERN]** Record external service responses as fixtures (WireMock mappings, MSW handlers, VCR cassettes, HAR files) with secrets and personal data scrubbed, and refresh them on a schedule to detect provider drift.
- **[PATTERN]** Boundary and edge data sets are explicit and named: empty strings, maximum lengths, Unicode (emoji, RTL, combining characters), time zone and DST boundaries, leap years, very large amounts, and currencies with 0 or 3 decimals.
- **[PERFORMANCE]** Large volume data for performance tests is generated by scripts (SQL `generate_series`, bulk loaders) to a documented size and distribution, not by replaying the UI; volumes reflect production cardinalities (e.g. tenants × orders per tenant).
- **[CONFIGURATION]** Test data scripts, builders, and anonymization rules are versioned with the code and reviewed like production code; environment reset (`make reset-test-data`) is automated and idempotent.
- **[TESTING]** Tests fail with a clear message when required reference data is missing, instead of producing confusing downstream errors; data setup failures are distinguishable from assertion failures in reports.
- **[REFERENCE]** See `references/test-data-management.md` for reference anti-patterns and best practices.

### 5. Flaky Test Prevention (`flaky-test-prevention`)

*Scope:* Preventing, detecting, and fixing flaky tests in any language: common root causes (timing, order dependence, shared state, time zones, randomness, network, resource leaks), detection by reruns and CI analytics, quarantine policy with ownership, and deterministic test design. Use it when a test fails intermittently or when hardening a test suite.

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
- **[REFERENCE]** See `references/flaky-test-prevention.md` for reference anti-patterns and best practices.

### 6. Mutation Testing (`mutation-testing`)

*Scope:* Measuring test effectiveness with mutation testing: PIT (Java/Kotlin), Stryker (JavaScript/TypeScript, C#), mutmut/cosmic-ray (Python), go-mutesting (Go); mutation score thresholds, incremental analysis on changed code, handling equivalent mutants, and killing surviving mutants with better assertions. Use it to evaluate whether tests would actually catch bugs.

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
- **[REFERENCE]** See `references/mutation-testing.md` for reference anti-patterns and best practices.

### 7. Accessibility Testing (`accessibility-testing`)

*Scope:* Testing accessibility (WCAG 2.2 AA) for web apps in any framework: automated checks with axe-core in unit/component and end-to-end tests, keyboard and focus tests, screen reader test plans (NVDA, VoiceOver), contrast and zoom checks, CI gates, and reporting. Use it when planning or implementing accessibility verification.

- **[ARCHITECTURE]** Combine three layers: automated rules (axe-core) catch roughly a third of WCAG issues, scripted keyboard/focus tests catch interaction issues, and manual assistive technology checks catch the rest; none replaces the others.
- **[MANDATORY]** Target WCAG 2.2 level AA: in axe use tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; zero violations on every key page and component state (empty, loading, error, open dialog, validation errors).
- **[PATTERN]** Automated checks at component level with `jest-axe`/`vitest-axe` (`expect(await axe(container)).toHaveNoViolations()`) and at page level with `@axe-core/playwright` (`new AxeBuilder({ page }).withTags([...]).analyze()`), Cypress (`cypress-axe`), or Selenium (`axe-core/webdriverjs`).
- **[MANDATORY]** Keyboard tests for every interactive flow: all controls reachable with Tab in a logical order, visible focus, activation with Enter/Space, Escape closes dialogs and menus, focus moves into opened dialogs and returns to the trigger on close, no keyboard traps.
- **[PATTERN]** Use role- and name-based queries in tests (`getByRole('button', { name: 'Save' })`): a test that cannot find an element by its accessible name has found an accessibility bug.
- **[PATTERN]** Manual screen reader test plan per release for critical journeys: NVDA + Firefox/Chrome and JAWS on Windows, VoiceOver + Safari on macOS/iOS, TalkBack + Chrome on Android; check announcements of headings, landmarks, form labels and errors, live regions, and dynamic content.
- **[PATTERN]** Visual checks: text contrast ≥ 4.5:1 (3:1 for large text and UI components), content usable at 200% zoom and reflow at 320 CSS px without horizontal scrolling, `prefers-reduced-motion` honored, target size ≥ 24×24 CSS px.
- **[FORBIDDEN]** Disabling axe rules globally to make the build green; exclusions are local (`exclude` selectors or `disableRules` on a specific test) with a ticket and justification, and third-party widgets outside your control are reported upstream.
- **[CONFIGURATION]** CI gate: accessibility checks run with the other tests on every PR; new violations fail the build; a baseline of known legacy violations (with tickets) is allowed only temporarily and must shrink over time.
- **[PATTERN]** Static analysis in the editor and CI (`eslint-plugin-jsx-a11y`, `@angular-eslint/template` accessibility rules, `eslint-plugin-vuejs-accessibility`) prevents common mistakes before tests run.
- **[PATTERN]** Report findings with the WCAG success criterion (e.g. 1.4.3 Contrast), impact, affected users, steps to reproduce with the assistive technology used, and the fix; prioritize blockers for task completion (cannot submit a form, cannot close a dialog).
- **[TESTING]** Mobile apps: use platform tools (Android Accessibility Scanner, Espresso accessibility checks, Xcode Accessibility Inspector, XCUITest with accessibility identifiers) plus manual TalkBack/VoiceOver checks.
- **[REFERENCE]** See `references/accessibility-testing.md` for reference anti-patterns and best practices.
