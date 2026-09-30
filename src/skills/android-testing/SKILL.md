---
name: android-testing
description: "Testing Android apps: local unit tests for ViewModels and repositories with fakes, kotlinx-coroutines-test and Turbine, Robolectric where Android APIs are needed, Compose UI tests with semantics, instrumented tests with Hilt test rules, in-memory Room, MockWebServer for networking, screenshot tests, and Gradle Managed Devices in CI. Use it when writing or reviewing Android tests."
---

# Skill: Android Testing

## Implementation Rules:
- **[ARCHITECTURE]** Follow the test pyramid: most tests are local JVM tests (`src/test`) for ViewModels, use cases, repositories, and mappers; Compose UI tests cover screens (locally with Robolectric or on device); a few instrumented end-to-end tests (`src/androidTest`) cover critical journeys.
- **[PATTERN]** Prefer fakes over mocks for your own interfaces (`FakeOrdersRepository` backed by a `MutableStateFlow`), and keep them in a shared `:core:testing` module; use MockK or Mockito only for interaction checks at boundaries you do not own.
- **[MANDATORY]** Test coroutines with `runTest` and test dispatchers injected into the code under test; replace `Dispatchers.Main` with a `MainDispatcherRule` for ViewModel tests, and assert flows with Turbine.
- **[PATTERN]** Test the data layer against real implementations where cheap: in-memory Room (`Room.inMemoryDatabaseBuilder`) for DAOs and migrations (`MigrationTestHelper` with exported schemas), and OkHttp `MockWebServer` for Retrofit or Ktor clients, asserting requests and error handling.
- **[MANDATORY]** Compose UI tests use `createComposeRule()` (or `createAndroidComposeRule<HiltTestActivity>()`), find nodes by semantics (text, content description, `testTag`), perform actions, and assert displayed state; stateless screen composables are tested with fixed `uiState` and recorded callbacks.
- **[PATTERN]** Instrumented tests with Hilt use `@HiltAndroidTest`, `HiltAndroidRule`, and `@TestInstallIn` modules replacing network and data bindings with fakes, so tests are hermetic.
- **[FORBIDDEN]** `Thread.sleep` or arbitrary delays in tests (use idling, `waitUntil`, or virtual time), tests hitting real backends, tests depending on execution order, and mocking data classes or Android framework types that have test doubles or fakes.
- **[PATTERN]** Add screenshot tests for the design system and key screens (Compose Preview Screenshot Testing, Roborazzi, or Paparazzi) across light/dark themes and font scales, with reviewed reference images.
- **[CONFIGURATION]** Run instrumented tests on Gradle Managed Devices or a device farm in CI (`./gradlew pixel6api34DebugAndroidTest` style tasks), with animations disabled and the Android Test Orchestrator for isolation.
- **[PERFORMANCE]** Keep local tests fast and parallel (`maxParallelForks`), and reserve device tests for behavior that truly needs a device.
- **[TESTING]** CI runs `./gradlew testDebugUnitTest`, lint, Compose and screenshot tests, and managed-device instrumented tests on pull requests, publishing reports and coverage (Kover or JaCoCo) with thresholds on changed modules.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
