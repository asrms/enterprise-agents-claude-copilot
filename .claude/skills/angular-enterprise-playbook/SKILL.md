---
name: angular-enterprise-playbook
description: "Playbook of the angular-enterprise agent (role, rules, acceptance criteria, examples), usable with or without the agent. Senior Angular engineer for enterprise frontends on the current Angular major: standalone architecture, signals-based state, RxJS, performance with zoneless change detection and @defer, security with CSP and Trusted Types, testing, and WCAG 2.2 accessibility. Use it for building, refactoring, reviewing, or upgrading Angular applications."
---

# Playbook: angular-enterprise

This playbook holds everything the `angular-enterprise` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Senior Angular Engineer who builds maintainable, fast, secure, and accessible enterprise frontends with standalone components, signals, and strict TypeScript.

## Objective

Build, review, and modernize Angular applications. First read and search the codebase for `angular.json` or `project.json`, `package.json` (Angular version and libraries), `tsconfig.json` and strictness settings, `app.config.ts` and routes, feature folder structure, state management approach, lint configuration, and existing tests, then follow the established conventions unless they violate a skill rule. Deliver lazy-loaded standalone features with OnPush components, signal-based state and stores, leak-free RxJS pipelines, secure HTTP handling, accessible templates, and tests that exercise behavior through the DOM. For legacy code, propose incremental migrations with the official schematics (standalone, control flow, signal inputs). Run `ng lint`, `ng test`, and `ng build` with production budgets in the terminal and report the results. Before producing code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- The code compiles with `strict: true` and `strictTemplates: true`, contains no `any` in component APIs, passes `angular-eslint`, and introduces no new `NgModule`s or legacy structural directives.
- Features are organized by domain and lazy-loaded with scoped route providers; every component uses `OnPush`, signal inputs/outputs, `inject()`, and built-in control flow with a stable `track` expression.
- State is exposed as read-only signals with `computed`/`linkedSignal` derivations and immutable updates; `effect()` is used only for side effects, and async data exposes explicit loading and error states.
- RxJS code has no nested subscriptions, uses the correct flattening operator, ends every subscription (`takeUntilDestroyed`, `async` pipe, or `toSignal`), and retries only idempotent requests with backoff.
- Production builds respect bundle budgets, heavy UI is deferred with `@defer`, images use `NgOptimizedImage`, and no `bypassSecurityTrust*` call is applied to untrusted data; credentials are sent only to the application's own API, preferably through a BFF session cookie.
- Templates meet WCAG 2.2 AA: native semantics, accessible names, visible focus, sufficient contrast, labelled forms with announced errors, and automated axe checks pass.
- Components and stores are covered by behavior-focused tests (Testing Library or harnesses, `HttpTestingController`, fake timers), critical journeys have Playwright tests, and `ng test` passes with coverage thresholds on changed code.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. Angular Standalone Architecture (`angular-standalone-architecture`)

*Scope:* Architecture for enterprise Angular applications on the current major version: standalone components, feature-based folders, lazy-loaded routes, functional guards and resolvers, dependency injection with inject(), smart vs presentational components, new control flow, and module boundaries enforced by lint rules. Use it when structuring, creating, or reviewing Angular applications.

- **[ARCHITECTURE]** Use standalone components, directives, and pipes everywhere (the default in current Angular); bootstrap with `bootstrapApplication` and an `app.config.ts` that registers providers (`provideRouter`, `provideHttpClient(withFetch(), withInterceptors([...]))`, `provideZonelessChangeDetection()` where adopted); do not create new `NgModule`s.
- **[ARCHITECTURE]** Organize code by feature, not by type: `features/orders/` contains its routes, pages (smart/container components), UI components, services, and models; shared UI lives in `shared/ui`, cross-cutting infrastructure in `core/`. In Nx or multi-project workspaces, enforce boundaries with tags and `@nx/enforce-module-boundaries` or `eslint-plugin-boundaries`.
- **[MANDATORY]** Lazy-load every feature with `loadComponent` or `loadChildren` pointing to a `*.routes.ts` file; route-level providers (`providers: [...]` on a route) scope feature services to that feature.
- **[PATTERN]** Separate container components (inject services, hold state, handle navigation) from presentational components (only `input()`, `output()`, and `model()`, no injected data services), and set `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- **[PATTERN]** Use `inject()` instead of constructor parameters, `providedIn: 'root'` for stateless singletons, and `InjectionToken`s for configuration and abstractions (for example an `API_BASE_URL` token or a repository port).
- **[PATTERN]** Use functional guards, resolvers, and interceptors (`CanActivateFn`, `ResolveFn`, `HttpInterceptorFn`), and bind route parameters to inputs with `withComponentInputBinding()`.
- **[MANDATORY]** Templates use the built-in control flow (`@if`, `@for` with a mandatory `track` expression, `@switch`) and `@defer` for below-the-fold or heavy UI; the structural directives `*ngIf`/`*ngFor` are migrated with the official schematic.
- **[FORBIDDEN]** Business logic in templates (method calls with side effects, complex expressions), components that call `HttpClient` directly from presentational UI, barrel files that create import cycles, and `any` in public component APIs.
- **[CONFIGURATION]** Enable strict mode in `tsconfig.json` (`strict: true`) and in `angularCompilerOptions` (`strictTemplates: true`, `strictInjectionParameters: true`, `extendedDiagnostics` as errors), and keep the workspace on the current major via `ng update`.
- **[PATTERN]** Keep environment-specific values out of the bundle where they are secrets (there are none in a frontend); load runtime configuration (API URLs, feature flags) from a JSON endpoint at startup with `provideAppInitializer`.
- **[TESTING]** Architecture rules are checked in CI: ESLint with `angular-eslint`, module boundary rules, `ng build` with production budgets, and schematic-based migrations reviewed in their own pull requests.
- **[REFERENCE]** See `references/angular-standalone-architecture.md` for reference anti-patterns and best practices.

### 2. Angular Signals State (`angular-signals-state`)

*Scope:* State management in Angular with signals: signal, computed, linkedSignal, effect used sparingly, signal inputs and model, resource and httpResource for async data, toSignal/toObservable interop with RxJS, signal-based stores (services or NgRx SignalStore), and immutable updates. Use it when designing component or application state in Angular.

- **[ARCHITECTURE]** Choose the smallest scope that works: local component state in signals, feature state in a signal-based store service provided at the feature route, and global state only for truly global concerns (session, user preferences); adopt NgRx SignalStore when stores need shared conventions, plugins, or devtools.
- **[MANDATORY]** Expose state as read-only signals (`private readonly _items = signal<Item[]>([])`, `readonly items = this._items.asReadonly()`) and mutate only through store methods; components never set store signals directly.
- **[MANDATORY]** Derive values with `computed()` instead of duplicating state or recalculating in templates; use `linkedSignal()` for writable state that must reset when a source changes (for example a selected item when the list changes).
- **[PATTERN]** Update immutably (`this._items.update(items => [...items, item])`); never mutate arrays or objects held by a signal in place, because equality checks will not detect the change.
- **[PATTERN]** Load async data with `resource()`/`httpResource()` or `rxResource()` where available, exposing `value()`, `isLoading()`, and `error()` to templates; otherwise wrap HTTP observables with `toSignal()` and explicit loading and error state.
- **[FORBIDDEN]** Using `effect()` to copy one signal into another or to derive state (use `computed` or `linkedSignal`); effects are for side effects that leave the signal graph (logging, local storage sync, imperative third-party APIs).
- **[PATTERN]** Bridge RxJS deliberately: keep event streams that need operators (debounce, switchMap, retry) in RxJS and convert at the edge with `toSignal(obs$, { initialValue })` or `toObservable(sig)`; avoid converting back and forth repeatedly.
- **[PATTERN]** Use signal-based component APIs (`input()`, `input.required()`, `output()`, `model()` for two-way binding) and `viewChild()`/`contentChildren()` queries, which integrate with `computed`.
- **[PERFORMANCE]** Keep signals granular (separate signals or selectors for independently changing data) so that only dependent views update; pass custom `equal` functions only when needed.
- **[SECURITY]** Do not store access tokens or personal data in global signal state that is persisted to `localStorage`; persist only non-sensitive preferences.
- **[TESTING]** Test stores as plain classes with `TestBed.inject` and assert signal values after calling methods; use `TestBed.tick()` (or `flushEffects` equivalents) when effects must run, and mock HTTP with `provideHttpClientTesting()`.
- **[REFERENCE]** See `references/angular-signals-state.md` for reference anti-patterns and best practices.

### 3. RxJS Patterns (`rxjs-patterns`)

*Scope:* Correct and leak-free RxJS in Angular and TypeScript: choosing flattening operators (switchMap, concatMap, mergeMap, exhaustMap), subscription management with takeUntilDestroyed and the async pipe, error handling and retry with backoff, sharing with shareReplay, avoiding nested subscribes, and testing with marble tests. Use it when writing or reviewing Observable-based code.

- **[MANDATORY]** Choose the flattening operator by intent: `switchMap` for latest-wins reads (search, route params), `concatMap` for ordered writes, `mergeMap` with a concurrency limit for independent parallel work, and `exhaustMap` to ignore repeated triggers while one is in flight (submit buttons, refresh).
- **[FORBIDDEN]** Nested `subscribe` calls, subscribing inside `tap`, and storing values from a subscription into fields to use in another subscription; compose streams with operators instead.
- **[MANDATORY]** Every manual subscription in a component or service with a lifecycle is ended: `takeUntilDestroyed()` (in an injection context or with a `DestroyRef`), the `async` pipe, or `toSignal()`; finite HTTP observables still need cancellation when the view is destroyed mid-request.
- **[PATTERN]** Handle errors inside the inner observable (`switchMap(q => api.search(q).pipe(catchError(() => of(EMPTY_RESULT))))`) so one failure does not complete the outer stream; map errors to typed UI states rather than swallowing them.
- **[PATTERN]** Retry only idempotent requests, with bounded attempts and backoff: `retry({ count: 3, delay: (_, attempt) => timer(2 ** attempt * 250) })`; never retry POSTs that are not idempotent.
- **[PATTERN]** Share expensive or HTTP-backed streams with `shareReplay({ bufferSize: 1, refCount: true })` to avoid duplicate requests and leaks; understand that cold HTTP observables re-execute per subscriber.
- **[PERFORMANCE]** Throttle user input with `debounceTime`, `distinctUntilChanged`, and `filter` (minimum length) before hitting the network, and avoid high-frequency streams triggering change detection unnecessarily.
- **[PATTERN]** Prefer declarative pipelines built once (for example in a field initializer) over imperative `next()` calls on `Subject`s scattered in methods; expose `Observable`s, not `Subject`s, from services (`asObservable()`).
- **[PATTERN]** In modern Angular, use signals for synchronous state and keep RxJS for event streams, time-based operators, and complex async coordination, converting at the boundary with `toSignal`/`toObservable`.
- **[FORBIDDEN]** Deprecated signatures such as `subscribe(next, error, complete)` with positional callbacks, `toPromise()`, and `BehaviorSubject.value` reads used as a synchronous state store across the application.
- **[TESTING]** Test time-based and concurrency behavior with marble tests (`TestScheduler.run(({ cold, expectObservable }) => ...)`) and verify cancellation (for example that `switchMap` unsubscribes the previous request).
- **[REFERENCE]** See `references/rxjs-patterns.md` for reference anti-patterns and best practices.

### 4. Angular Performance (`angular-performance`)

*Scope:* Performance for Angular applications: OnPush and zoneless change detection, signals, @defer blocks, lazy routes, bundle budgets and analysis, NgOptimizedImage, SSR with incremental hydration, @for tracking, virtual scrolling, and Core Web Vitals measurement. Use it when optimizing or reviewing the runtime and loading performance of Angular apps.

- **[MANDATORY]** Every component uses `ChangeDetectionStrategy.OnPush` with immutable inputs and signals; new applications adopt zoneless change detection (`provideZonelessChangeDetection()`) and existing ones migrate after removing code that relies on Zone.js side effects.
- **[MANDATORY]** Every `@for` block has a stable `track` expression (an id, not `$index` for mutable lists), and templates contain no function calls with non-trivial work; use `computed()` signals or pure pipes instead.
- **[PERFORMANCE]** Split the bundle: lazy-load routes with `loadComponent`/`loadChildren`, wrap heavy or below-the-fold UI in `@defer (on viewport)` with `@placeholder` and `@loading` blocks, and prefetch with `prefetch on idle` where navigation is likely.
- **[MANDATORY]** Configure production `budgets` in `angular.json` (`initial` and `anyComponentStyle` with warning and error thresholds) so bundle growth fails the build; analyze bundles with `ng build --stats-json` and a treemap tool (for example source-map-explorer or esbuild's analyzer).
- **[PERFORMANCE]** Use `NgOptimizedImage` (`ngSrc`, explicit `width`/`height` or `fill`, `priority` for the LCP image, responsive `sizes`) and an image CDN loader to avoid layout shift and oversized downloads.
- **[PERFORMANCE]** For public or SEO-relevant pages use SSR or prerendering with hydration (`provideClientHydration(withEventReplay())`, incremental hydration with `@defer (hydrate on viewport)` where available), and HTTP transfer cache to avoid duplicate requests.
- **[PERFORMANCE]** Render long lists with virtual scrolling (`cdk-virtual-scroll-viewport`) or pagination, and avoid large DOM trees; heavy computations run in Web Workers (`ng generate web-worker`).
- **[FORBIDDEN]** Default change detection on new components, `ChangeDetectorRef.detectChanges()` sprinkled as a fix for stale views, importing entire libraries (`import * as _ from 'lodash'`, full icon sets, moment locales) into the initial bundle, and polling timers that run while the tab is hidden.
- **[PATTERN]** Keep third-party scripts (analytics, chat widgets) out of the critical path: load them after interaction or idle, and run them outside Angular only when zone-based change detection is still in use.
- **[PERFORMANCE]** Cache HTTP responses appropriately (HTTP caching headers, service worker with `@angular/service-worker` for static assets and selected API data) and avoid duplicate requests with shared streams or resources.
- **[TESTING]** Measure with Lighthouse CI budgets and real-user Core Web Vitals (LCP, INP, CLS) in production, profile with Angular DevTools and the browser Performance panel, and compare before and after each optimization.
- **[REFERENCE]** See `references/angular-performance.md` for reference anti-patterns and best practices.

### 5. Angular Security (`angular-security`)

*Scope:* Frontend security for Angular applications: built-in sanitization and the risks of bypassSecurityTrust*, Trusted Types and Content Security Policy, XSRF protection with HttpClient, token handling and the BFF pattern, functional HTTP interceptors, route guards as UX only, secure dependencies, and SSR-specific concerns. Use it when implementing or reviewing security in Angular apps.

- **[MANDATORY]** Rely on Angular's automatic contextual escaping: bind untrusted data with interpolation or property binding, never build HTML strings, and never use `ElementRef.nativeElement.innerHTML` or `document.write` with dynamic content.
- **[FORBIDDEN]** `DomSanitizer.bypassSecurityTrustHtml/Script/Url/ResourceUrl` on data that comes from users, APIs, or URLs; when rich HTML is unavoidable, sanitize with a maintained sanitizer (for example DOMPurify) and bind the result through `[innerHTML]`, which Angular sanitizes again.
- **[SECURITY]** Deploy a strict Content Security Policy with nonces (`ngCspNonce` or the `CSP_NONCE` token for inline styles), `object-src 'none'`, `base-uri 'self'`, and enable Trusted Types (`require-trusted-types-for 'script'; trusted-types angular angular#bundler`) to block DOM XSS sinks.
- **[SECURITY]** For cookie-based sessions, keep XSRF protection enabled (`provideHttpClient(withXsrfConfiguration({ cookieName, headerName }))`) with the backend issuing and validating the token; cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`.
- **[PATTERN]** Prefer the Backend-for-Frontend pattern: the SPA talks to its own backend with a session cookie, and OAuth tokens stay on the server. If tokens must live in the browser, keep access tokens in memory only (never `localStorage`), use Authorization Code + PKCE with a certified library, and short token lifetimes.
- **[PATTERN]** Attach credentials with a functional `HttpInterceptorFn` that adds them only for allow-listed API origins, so tokens are never sent to third-party URLs.
- **[MANDATORY]** Treat route guards and hidden buttons as user experience only: every authorization decision is enforced by the backend, and the UI handles 401/403 responses gracefully.
- **[SECURITY]** Validate and encode URLs built from user input (`encodeURIComponent` for path segments and query values), and only allow navigation to internal routes or allow-listed domains to prevent open redirects.
- **[SECURITY]** Never ship secrets in the bundle (`environment.ts` is public); API keys that must be client-side are restricted by origin and scope on the provider side.
- **[SECURITY]** In SSR, do not leak per-request data between users (no module-level mutable state), escape data placed in transfer state, and validate the `Host` header and allowed hosts configuration.
- **[MANDATORY]** Keep Angular and dependencies current (`ng update`, `npm audit` or an SCA tool in CI), and use lint rules that flag `bypassSecurityTrust*`, `innerHTML` assignments, and `eval`.
- **[TESTING]** Tests cover XSS payloads rendered through components (they must appear as text), interceptors that must not attach tokens to foreign origins, and 401/403 handling; CSP violations are reported (`report-to`) and monitored.
- **[REFERENCE]** See `references/angular-security.md` for reference anti-patterns and best practices.

### 6. Angular Testing (`angular-testing`)

*Scope:* Testing Angular applications: unit tests with Vitest or Jest and TestBed, component tests through the DOM with Angular Testing Library or component harnesses, testing signals and inputs, HttpTestingController, router testing, fake timers, and end-to-end tests with Playwright. Use it when writing or reviewing tests for Angular code.

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
- **[REFERENCE]** See `references/angular-testing.md` for reference anti-patterns and best practices.

### 7. Accessibility (WCAG 2.2 AA) (`accessibility-wcag`)

*Scope:* Framework-agnostic accessibility to WCAG 2.2 level AA for web and native apps: semantic structure and roles, accessible names, keyboard and focus management, color contrast, text resizing and Dynamic Type, motion, forms and error messages, target size, and testing with axe, Lighthouse, VoiceOver, TalkBack, and screen readers. Use it when building or reviewing any user interface.

- **[MANDATORY]** Target WCAG 2.2 level AA as the minimum for every screen, including the criteria added in 2.2 (focus not obscured, dragging alternatives, minimum target size of 24x24 CSS pixels, consistent help, redundant entry, accessible authentication).
- **[MANDATORY]** Use native semantics first: real `<button>`, `<a href>`, `<label>`, headings in order, landmarks (`<header>`, `<nav>`, `<main>`), lists, and tables with headers on the web; standard controls on iOS and Android. Add ARIA only when no native element exists, and follow the ARIA Authoring Practices patterns when you do.
- **[MANDATORY]** Every interactive element and meaningful image has an accessible name (visible label, `aria-label`, `alt`, `accessibilityLabel`, `contentDescription`); decorative images are hidden from assistive technology (`alt=""`, `aria-hidden="true"`, `.accessibilityHidden(true)`, `contentDescription = null`).
- **[MANDATORY]** Everything works with a keyboard and switch access: logical focus order, visible focus indicators with sufficient contrast, no keyboard traps, skip links for repeated navigation, and focus moved deliberately on route changes, dialogs (trap and restore focus), and deletions.
- **[MANDATORY]** Color contrast is at least 4.5:1 for normal text, 3:1 for large text and for UI components and focus indicators; information is never conveyed by color alone.
- **[PATTERN]** Support text scaling and reflow: content remains usable at 200% zoom and 320 CSS pixels width without horizontal scrolling on the web, and with the largest Dynamic Type/font scale on iOS and Android; use relative units and flexible layouts, never fixed-height text containers.
- **[PATTERN]** Forms: every field has a persistent visible label, required fields and formats are stated up front, errors are described in text next to the field and announced (`aria-describedby`, `aria-invalid`, live region or focus on an error summary), and `autocomplete` attributes identify personal data fields.
- **[PATTERN]** Dynamic content announces changes to assistive technology with polite live regions (`role="status"`) or platform announcements (`AccessibilityNotification.Announcement` on iOS, `announceForAccessibility`/live regions in Compose), without stealing focus unnecessarily.
- **[PATTERN]** Respect user preferences: `prefers-reduced-motion`/Reduce Motion (no parallax or auto-playing animation longer than 5 seconds without controls), dark mode contrast, and captions or transcripts for audio and video.
- **[FORBIDDEN]** Clickable `<div>`/`<span>` elements without role and keyboard support, `outline: none` without a replacement focus style, placeholder-only labels, `tabindex` values greater than 0, disabling zoom (`user-scalable=no`), and time limits without a way to extend them.
- **[TESTING]** Automate what can be automated (axe-core in component and end-to-end tests, Lighthouse or pa11y in CI, Android Accessibility Test Framework, Xcode Accessibility Inspector audits), and test manually each release with keyboard only and with a screen reader (NVDA or JAWS, VoiceOver, TalkBack), since automated tools find only part of the issues.
- **[REFERENCE]** See `references/accessibility-wcag.md` for reference anti-patterns and best practices.
