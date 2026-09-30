---
name: mobile-testing
description: "Testing cross-platform mobile apps: Flutter unit, widget, golden, and integration tests; React Native tests with Jest and React Native Testing Library; network mocking with MSW or fake repositories; end-to-end flows with Maestro, Patrol, or Detox; device matrices and cloud device farms; and deterministic test data. Use it when writing or reviewing tests for Flutter or React Native apps."
---

# Skill: Mobile Testing

## Implementation Rules:
- **[ARCHITECTURE]** Follow the pyramid: many fast unit tests for view models, notifiers, stores, and repositories; widget/component tests for screens; a small set of end-to-end tests for critical journeys (login, checkout, offline save) on real devices or emulators.
- **[PATTERN]** Flutter: unit tests with `package:test`, widget tests with `testWidgets`, `pumpWidget`, finders by key, text, or semantics, and provider/repository overrides (`ProviderScope(overrides: [...])`); golden tests for design-system widgets with fixed fonts and device sizes.
- **[PATTERN]** React Native: Jest with React Native Testing Library, querying by role, label, and text (`screen.getByRole('button', { name: 'Checkout' })`), `userEvent` interactions, and MSW (`msw/native`) or fake API clients for network behavior.
- **[MANDATORY]** Inject dependencies so tests use fakes for network, storage, clock, and platform services; never call real backends or third-party SDKs from unit and widget/component tests.
- **[MANDATORY]** Await async work properly (`await tester.pumpAndSettle()` or explicit `pump(duration)`, `findBy*` and `waitFor` in RNTL) and control time with fake timers or injected clocks; no fixed sleeps.
- **[PATTERN]** End-to-end tests use stable selectors (Flutter `Key`s/semantics labels, React Native `testID` and accessibility labels), a seeded test backend or mock server, and fresh app state per test; prefer Maestro flows for readability or Patrol/Detox when deep native interaction is needed.
- **[FORBIDDEN]** Snapshot tests of whole screens as the main assertion, tests relying on production data or accounts, E2E tests that depend on each other's state, and skipping failing tests without an issue.
- **[PATTERN]** Cover platform differences deliberately: run E2E suites on both iOS and Android, on the minimum supported OS and a recent one, and on small and large screens (device farm such as Firebase Test Lab, BrowserStack, or AWS Device Farm).
- **[PATTERN]** Test accessibility and localization: semantics labels present (`meetsGuideline(androidTapTargetGuideline)` and `textContrastGuideline` in Flutter), large font scales, right-to-left layouts, and long translations.
- **[PERFORMANCE]** Keep the suite fast: run unit and widget/component tests on every pull request, shard E2E tests, and run the full device matrix nightly or before release.
- **[TESTING]** CI publishes JUnit reports and coverage (`flutter test --coverage`, `jest --coverage`) with thresholds on changed code, records videos and screenshots for failed E2E runs, and tracks flaky tests to fix or quarantine.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
