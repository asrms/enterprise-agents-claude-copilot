---
name: e2e-testing-playwright
description: "Reliable end-to-end tests with Playwright for any web app: user-facing locators, web-first assertions, authentication via storage state, test isolation, network mocking, fixtures and page objects, parallelism and sharding, traces, and CI setup. Use it when writing or reviewing browser end-to-end tests."
---

# Skill: End-to-End Testing with Playwright

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
