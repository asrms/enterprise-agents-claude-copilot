---
name: xctest-testing
description: "Testing Apple platform apps with Swift Testing and XCTest: @Test and #expect, parameterized tests, suites and traits, async tests, protocol-based fakes, testing @Observable models, UI tests with XCUITest and accessibility identifiers, snapshot tests, test plans, and running tests in CI with xcodebuild. Use it when writing or reviewing tests for iOS or macOS code."
---

# Skill: XCTest and Swift Testing

## Implementation Rules:
- **[ARCHITECTURE]** Write new unit and integration tests with Swift Testing (`import Testing`, `@Test`, `#expect`, `#require`, `@Suite`), keep XCTest for UI tests (XCUITest) and performance tests, and run both in the same test plans.
- **[PATTERN]** Name tests by behavior (`@Test("Paying a cancelled order fails")`), use parameterized tests (`@Test(arguments: [...])`) instead of copy-pasted cases, and use `#require` to unwrap preconditions so failures stop the test with a clear message.
- **[MANDATORY]** Test models and services without UI: inject protocol-based fakes for networking, persistence, clocks, and notifications, and assert state transitions of `@Observable` models after awaiting their async methods.
- **[PATTERN]** Test async code with `async` test functions; verify thrown errors with `#expect(throws: OrderError.alreadyCancelled) { try await ... }`, and use `confirmation()` for callback- or event-based expectations instead of sleeps.
- **[PATTERN]** Test networking code with a `URLProtocol` stub registered on a custom `URLSessionConfiguration`, asserting request method, path, headers, and body, and simulating error and timeout responses.
- **[MANDATORY]** UI tests use accessibility identifiers (`.accessibilityIdentifier("orders.list")`) or accessibility labels to find elements, wait with `waitForExistence(timeout:)`, and launch the app with arguments or environment that select stubbed services and deterministic data.
- **[FORBIDDEN]** Tests that depend on the live network or production services, shared mutable state across tests (Swift Testing runs tests in parallel by default), `sleep()` for synchronization, and UI tests that locate elements by index or display text that is localized.
- **[PATTERN]** Use snapshot tests (for example `swift-snapshot-testing`) for design system components and critical screens across Dynamic Type sizes and color schemes, with reviewed reference images.
- **[CONFIGURATION]** Organize tests in Xcode test plans with configurations (locale, region, sanitizers), enable Thread Sanitizer or Address Sanitizer in a CI configuration, and enable code coverage for app and package targets.
- **[PERFORMANCE]** Keep unit tests fast (no UI host application when not needed, packages tested with `swift test`), and keep UI tests few and focused on critical user journeys.
- **[TESTING]** CI runs `xcodebuild test -scheme <Scheme> -testPlan <Plan> -destination 'platform=iOS Simulator,name=<device>'` (or `swift test` for packages), publishes the `.xcresult` bundle, and enforces coverage on changed code.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
