---
name: vue-testing-vitest
description: "Testing Vue 3 and Nuxt applications with Vitest: component tests with Vue Testing Library or Vue Test Utils, testing composables, Pinia testing, mocking HTTP with MSW, fake timers, Nuxt tests with @nuxt/test-utils, Vitest browser mode, and end-to-end tests with Playwright. Use it when writing or reviewing tests for Vue code."
---

# Skill: Vue Testing with Vitest

## Implementation Rules:
- **[ARCHITECTURE]** Use Vitest as the test runner (shared Vite config, fast watch mode) for unit and component tests, `@nuxt/test-utils` for Nuxt-specific code, and Playwright for a small set of end-to-end journeys against a production build.
- **[MANDATORY]** Test components through user-visible behavior with Vue Testing Library (`render`, `screen.getByRole`, `userEvent`) or Vue Test Utils (`mount`, `find`, `trigger`), asserting rendered output and emitted events (`emitted()`), not internal state or private functions.
- **[PATTERN]** Run component tests in a realistic DOM: `happy-dom` or `jsdom` environments for speed, or Vitest browser mode with Playwright when layout, focus, or real browser APIs matter.
- **[PATTERN]** Test composables directly; when they use lifecycle hooks or `inject`, mount them in a minimal host component or run them inside an `effectScope`, and stop the scope after the test.
- **[PATTERN]** Mock HTTP at the network boundary with MSW (`setupServer` with handlers per test) instead of mocking `fetch` or modules deeply, and configure `onUnhandledRequest: 'error'` so unexpected calls fail.
- **[PATTERN]** Use `createTestingPinia` for components that use stores, and fresh Pinia instances (`setActivePinia(createPinia())`) for store unit tests.
- **[MANDATORY]** Await async updates correctly (`await nextTick()`, `await flushPromises()`, or `findBy*` queries) and control time with `vi.useFakeTimers()` for debounce and polling; never use real sleeps.
- **[PATTERN]** In Nuxt, test components with `mountSuspended` (auto-imports and plugins available), mock Nuxt composables with `mockNuxtImport`, and test server routes by starting the app with `setup()` and calling `$fetch`.
- **[FORBIDDEN]** Snapshot tests of whole pages as the primary assertion, shallow mounting everything by default (it hides integration bugs), tests sharing mutable module state, and `.only` committed to the repository.
- **[PATTERN]** Keep tests fast and isolated: reset mocks with `vi.restoreAllMocks()` in `afterEach`, use factories for test data, and avoid global plugin state leaking between tests.
- **[TESTING]** CI runs `vue-tsc --noEmit`, `vitest run --coverage` with thresholds on changed code, and Playwright tests with accessibility checks (axe) on key pages.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
