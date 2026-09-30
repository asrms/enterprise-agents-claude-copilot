---
name: angular-testing
description: "Testing Angular applications: unit tests with Vitest or Jest and TestBed, component tests through the DOM with Angular Testing Library or component harnesses, testing signals and inputs, HttpTestingController, router testing, fake timers, and end-to-end tests with Playwright. Use it when writing or reviewing tests for Angular code."
---

# Skill: Angular Testing

## Implementation Rules:
- **[ARCHITECTURE]** Use the test runner supported by the current Angular CLI (Vitest for new projects, or Jest; Karma/Jasmine only for legacy suites being migrated), with fast unit and component tests and a small set of Playwright end-to-end tests for critical journeys.
- **[MANDATORY]** Test components through their public behavior: render them, interact through the DOM or component harnesses, and assert what the user sees (Angular Testing Library queries such as `getByRole` and `getByLabelText`), not private fields or method calls.
- **[PATTERN]** Configure providers explicitly in `TestBed.configureTestingModule({ providers: [...] })`: `provideHttpClient()` plus `provideHttpClientTesting()` for HTTP, `provideRouter(routes)` with `RouterTestingHarness` for routing, and `provideZonelessChangeDetection()` when the app is zoneless.
- **[PATTERN]** Set signal inputs with `fixture.componentRef.setInput('order', value)` (or the testing library's inputs option), then `await fixture.whenStable()`; do not assign to input properties directly.
- **[PATTERN]** Replace collaborators at their boundary: provide fake implementations of services or tokens (`{ provide: OrdersApi, useValue: fakeApi }`), and use `HttpTestingController` (`expectOne`, `flush`, `verify`) to assert real HTTP calls made by services.
- **[PATTERN]** Use Angular CDK component harnesses (`TestbedHarnessEnvironment.loader(fixture)`) for Angular Material and your own reusable components, so tests survive DOM refactors.
- **[MANDATORY]** Control time deterministically with fake timers (`vi.useFakeTimers()`, or `fakeAsync`/`tick` in zone-based suites) for debounce and polling logic; never wait with real `setTimeout` in tests.
- **[FORBIDDEN]** Shallow tests that only assert `component` is truthy, snapshot tests of large templates as the main assertion, `NO_ERRORS_SCHEMA` to silence template errors, and end-to-end tests that depend on shared data or fixed sleeps.
- **[PATTERN]** Test stores and pure functions without TestBed where possible; they are plain TypeScript and run fastest.
- **[PATTERN]** End-to-end tests with Playwright use role-based locators, web-first assertions, isolated test data per test, and network mocking only for third-party services.
- **[TESTING]** CI runs `ng test` with coverage thresholds on changed code, `ng lint`, and Playwright on the production build, and includes automated accessibility checks (axe) in component or end-to-end tests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
