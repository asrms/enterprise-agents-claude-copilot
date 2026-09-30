---
name: vue-nuxt-playbook
description: "Playbook of the vue-nuxt agent (role, rules, acceptance criteria, examples), usable with or without the agent. Senior Vue and Nuxt engineer: Vue 3 Composition API with TypeScript, Pinia state, Nuxt rendering and caching strategies, performance, security, Vitest testing, and WCAG 2.2 accessibility. Use it for building, refactoring, reviewing, or upgrading Vue 3 and Nuxt applications."
---

# Playbook: vue-nuxt

This playbook holds everything the `vue-nuxt` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Senior Vue and Nuxt Engineer who builds typed, fast, secure, and accessible applications with the Composition API, Pinia, and the right rendering strategy for each route.

## Objective

Build, review, and modernize Vue 3 and Nuxt applications. First read and search the codebase for `package.json` (Vue, Nuxt, and library versions), `nuxt.config.ts` or `vite.config.ts`, `tsconfig.json`, the folder structure (`pages/`, `components/`, `composables/`, `server/`, `stores/`), route rules and runtime config, lint configuration, and existing tests, then follow the established conventions unless they violate a skill rule. Deliver `<script setup lang="ts">` components with typed props and emits, reusable composables, focused Pinia stores, SSR-safe data fetching with deliberate caching, secure server routes, accessible templates, and behavior-focused tests. For Options API or Vue 2 code, propose incremental migrations. Run `vue-tsc --noEmit`, ESLint, `vitest run`, and the production build (`nuxi build` or `vite build`) in the terminal and report the results. Before producing code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- Code passes `vue-tsc --noEmit` with strict TypeScript and `eslint-plugin-vue` recommended rules; components use `<script setup lang="ts">`, typed `defineProps`/`defineEmits`/`defineModel`, never mutate props, and every `v-for` has a stable key.
- Derived data uses `computed`, watchers are limited to side effects and clean up in-flight work, and reusable logic lives in `useX` composables organized by feature.
- Shared state lives in focused Pinia setup stores changed only through actions, read with `storeToRefs`, with explicit async status; no tokens or personal data are persisted in web storage.
- Nuxt pages fetch with `useFetch`/`useAsyncData` (no double fetching), rendering and caching are chosen per route with `routeRules`, cache keys include every varying input, and secrets exist only in private `runtimeConfig` used by server routes that validate input.
- No unsanitized `v-html`, no user-controlled URLs without scheme validation, no per-user state in module-level server variables, and authorization is enforced by the API rather than router guards.
- Large data uses `shallowRef`/`markRaw`, long lists are virtualized, heavy components and libraries are code-split, and bundle and Lighthouse budgets pass in CI.
- UI meets WCAG 2.2 AA with automated axe checks passing, and components, composables, stores, and server routes are covered by Vitest tests using Testing Library or `mountSuspended` with MSW, plus Playwright tests for critical journeys.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. Vue Composition API (`vue-composition-api`)

*Scope:* Idiomatic Vue 3 with the Composition API and TypeScript: script setup single-file components, typed props and emits, defineModel, ref vs reactive, computed and watchers, composables for reusable logic, provide/inject with typed keys, template refs, and feature-based project structure. Use it when writing or reviewing Vue 3 components and composables.

- **[MANDATORY]** Write components as `<script setup lang="ts">` single-file components with typed `defineProps<...>()` and `defineEmits<...>()`, and use `defineModel()` for two-way bindings instead of manual `modelValue`/`update:modelValue` plumbing.
- **[PATTERN]** Prefer `ref()` for state (works for primitives and objects, explicit `.value`), use `reactive()` only for cohesive objects that are never reassigned or destructured, and use `toRefs`/reactive props destructure (Vue 3.5+) to keep reactivity when destructuring.
- **[MANDATORY]** Derive data with `computed()`; never duplicate derived state in refs kept in sync by watchers. Computed getters are pure: no side effects, no async work, no mutation.
- **[PATTERN]** Use `watch` with explicit sources for side effects that react to specific changes (fetching on id change, syncing to URL), `watchEffect` only for simple effects, and clean up with `onWatcherCleanup` or the `onCleanup` argument (abort in-flight requests).
- **[ARCHITECTURE]** Extract reusable stateful logic into composables (`useOrders`, `usePagination`) named `useX`, placed in `composables/`, that accept refs or getters (`MaybeRefOrGetter` with `toValue`) and return refs and functions; composables do not touch the DOM unless that is their purpose.
- **[ARCHITECTURE]** Organize by feature (`features/orders/components`, `features/orders/composables`, `features/orders/api.ts`), keep components small with a single responsibility, and separate presentational components (props in, events out) from containers that fetch and orchestrate.
- **[PATTERN]** Use `provide`/`inject` with typed `InjectionKey<T>` symbols for dependency injection across deep trees, providing readonly refs (`readonly(state)`) plus mutation functions.
- **[PATTERN]** Use `useTemplateRef()` for template refs, `defineExpose` sparingly, and `v-model` modifiers or custom `defineModel` transforms instead of mutating props.
- **[FORBIDDEN]** Mutating props, the Options API mixed with the Composition API in new code, mixins, `this` in `<script setup>`, `v-if` together with `v-for` on the same element, and `v-for` without a stable `:key`.
- **[CONFIGURATION]** Enable `strict` TypeScript, type-check templates with `vue-tsc --noEmit` in CI, and lint with `eslint-plugin-vue` (recommended rules) and the TypeScript ESLint config.
- **[TESTING]** Composables are unit-tested directly (wrapping in a host component or `effectScope` when they use lifecycle hooks), and components are tested through rendered output and emitted events.
- **[REFERENCE]** See `references/vue-composition-api.md` for reference anti-patterns and best practices.

### 2. Pinia State Management (`pinia-state`)

*Scope:* Application state with Pinia for Vue and Nuxt: when to use a store vs local state, setup stores with TypeScript, storeToRefs, actions for async work and error states, SSR-safe stores in Nuxt, persistence without sensitive data, store composition, and testing with @pinia/testing. Use it when designing or reviewing shared state in Vue applications.

- **[ARCHITECTURE]** Keep state local by default (component refs, composables); introduce a Pinia store only for state shared across distant components or routes (session, cart, feature-wide filters). Server data that is only displayed is better handled by a data-fetching layer (`useFetch`/`useAsyncData` in Nuxt, or a query library) than copied into stores.
- **[PATTERN]** Define setup stores (`defineStore('orders', () => { ... })`) with `ref` for state, `computed` for getters, and functions for actions; return only what consumers need, and name stores after a domain concept (`useCartStore`).
- **[MANDATORY]** Destructure store state and getters with `storeToRefs(store)` to keep reactivity; call actions directly from the store instance.
- **[MANDATORY]** State changes happen through actions with clear names (`addItem`, `applyCoupon`); components do not mutate store state directly or use `$patch` for business operations.
- **[PATTERN]** Async actions track status explicitly (`status: 'idle' | 'loading' | 'success' | 'error'` and an `error` value), cancel or ignore stale requests, and return results or throw typed errors that callers can handle.
- **[SECURITY]** Persist only non-sensitive preferences (for example with `pinia-plugin-persistedstate`): never tokens, personal data, or payment details in `localStorage`/`sessionStorage`.
- **[PATTERN]** In Nuxt, stores are created per request on the server (via `@pinia/nuxt`), so no module-level mutable state exists outside stores; hydrate state from server fetches with `callOnce` or `useAsyncData` to avoid double fetching.
- **[PATTERN]** Compose stores by calling another store inside an action or getter (`const user = useUserStore()`), avoiding circular dependencies between stores at setup time.
- **[FORBIDDEN]** One giant global store for the whole application, storing derived values as state, storing non-serializable objects (class instances with methods, DOM nodes) in state used with SSR, and accessing stores outside `setup`/actions before Pinia is installed.
- **[PERFORMANCE]** Keep stores focused and state normalized (entities by id plus ordered id lists) for large collections, and use `shallowRef` for large immutable datasets.
- **[TESTING]** Unit-test stores with `setActivePinia(createPinia())` and a fresh Pinia per test; in component tests use `createTestingPinia({ initialState, stubActions })` from `@pinia/testing` and assert rendered output and called actions.
- **[REFERENCE]** See `references/pinia-state.md` for reference anti-patterns and best practices.

### 3. Nuxt Rendering and Caching (`nuxt-rendering-caching`)

*Scope:* Rendering and data fetching in Nuxt (current major): SSR, SSG, SPA and hybrid route rules, useFetch and useAsyncData with keys, avoiding double fetching, server routes with Nitro, caching with routeRules (swr, isr, prerender) and cachedEventHandler, runtime config and secrets, and deployment presets. Use it when building or reviewing Nuxt applications.

- **[ARCHITECTURE]** Choose rendering per route with `routeRules` in `nuxt.config.ts`: `prerender: true` for static marketing and docs pages, `swr`/`isr` for public content that tolerates staleness, SSR for personalized pages, and `ssr: false` only for authenticated app areas that gain nothing from server rendering.
- **[MANDATORY]** Fetch data in components with `useFetch` or `useAsyncData` (or `$fetch` inside `useAsyncData`) so it is fetched once on the server and transferred to the client; never call raw `$fetch`/`fetch` at the top level of `setup` during SSR, which fetches twice.
- **[PATTERN]** Give `useAsyncData` stable, unique keys, pass reactive parameters via `query`/`watch` options, use `lazy: true` with explicit `status` handling for non-critical data, and `pick`/`transform` to send only the fields the page needs in the payload.
- **[PATTERN]** Put backend-for-frontend logic in Nitro server routes (`server/api/*.ts` with `defineEventHandler`), validate input with `getValidatedQuery`/`readValidatedBody` and a schema (Zod), and call internal services from there so secrets never reach the browser.
- **[MANDATORY]** Configuration uses `runtimeConfig`: private keys (API secrets) at the top level are server-only; only values under `runtimeConfig.public` reach the client. Values are overridden per environment with `NUXT_`-prefixed environment variables, never hard-coded.
- **[PERFORMANCE]** Cache server work deliberately: `cachedEventHandler`/`defineCachedFunction` with `maxAge`, `swr`, and a `getKey` that includes every input that affects the response, and route-level cache headers; never cache responses that depend on cookies or authorization under a shared key.
- **[FORBIDDEN]** Accessing `window`, `document`, or `localStorage` during SSR outside `onMounted`/`import.meta.client` guards, module-level mutable state in server code shared across requests, and exposing secrets through `runtimeConfig.public` or `useState` payloads.
- **[PATTERN]** Share SSR-safe state with `useState('key', () => init)` or Pinia; use `<ClientOnly>` for browser-only widgets and `useHead`/`useSeoMeta` for per-page metadata.
- **[PERFORMANCE]** Use Nuxt Image (`<NuxtImg>`) for responsive images, lazy components (`Lazy` prefix, `hydrate-on-visible` lazy hydration where available), and route-level code splitting that Nuxt provides by default; audit payload size in `__NUXT__` data.
- **[CONFIGURATION]** Select the Nitro deployment preset for the target (Node server, serverless, edge) and verify that caching storage (`nitro.storage`) uses a shared backend such as Redis when running multiple instances.
- **[TESTING]** Test pages and server routes with `@nuxt/test-utils` (`mountSuspended` for components, `$fetch` against a started test server for API routes) and check rendered HTML for SSR correctness and hydration warnings.
- **[REFERENCE]** See `references/nuxt-rendering-caching.md` for reference anti-patterns and best practices.

### 4. Vue Performance (`vue-performance`)

*Scope:* Runtime and loading performance for Vue 3 and Nuxt: fine-grained reactivity with computed and shallowRef, stable keys, v-memo and v-once, async components and route-level code splitting, virtual lists, avoiding expensive watchers, bundle analysis with Vite, image optimization, and measuring Core Web Vitals. Use it when optimizing or reviewing Vue application performance.

- **[MANDATORY]** Measure before optimizing: profile with Vue DevTools (component render timings) and the browser Performance panel, and track Core Web Vitals (LCP, INP, CLS) from real users; state the metric each change improves.
- **[PERFORMANCE]** Keep reactivity fine-grained: derive with `computed` (cached), pass primitives or stable objects as props so child components skip updates, and avoid passing fresh object or array literals and inline functions that change identity on every render to heavy children.
- **[PERFORMANCE]** Use `shallowRef`/`shallowReactive` for large immutable data (API responses, chart datasets) and replace them wholesale on change; use `markRaw` for third-party instances (maps, editors, charts) that must not be made reactive.
- **[MANDATORY]** Every `v-for` has a stable, unique `:key` (an id, never the index for lists that reorder or change), and lists of hundreds of items use virtualization (for example `vue-virtual-scroller` or TanStack Virtual) or pagination.
- **[PERFORMANCE]** Use `v-once` for static content rendered from data once, and `v-memo` for large lists where rows depend on a few known values; do not sprinkle them without measurement.
- **[PERFORMANCE]** Split code: route components are lazy (`component: () => import('./pages/Orders.vue')`), heavy widgets use `defineAsyncComponent` (with lazy hydration strategies such as `hydrateOnVisible` in SSR), and large libraries are imported per function.
- **[FORBIDDEN]** Deep watchers (`deep: true`) on large objects for routine logic, watchers that set other state which a `computed` could derive, synchronous heavy computation in templates or computed properties during typing, and whole-library imports such as full lodash or moment with all locales.
- **[PERFORMANCE]** Debounce or throttle input-driven work, move CPU-heavy processing to Web Workers, and keep `<KeepAlive>` limited with `max` to avoid unbounded memory use.
- **[CONFIGURATION]** Enforce bundle budgets in CI (for example `rollup-plugin-visualizer` report plus a size limit tool such as `size-limit`), and configure Vite `build.rollupOptions.output.manualChunks` only when analysis shows a benefit.
- **[PERFORMANCE]** Optimize media and fonts: responsive images with explicit dimensions and lazy loading (`loading="lazy"` or `<NuxtImg>`), priority loading for the LCP image, and `font-display: swap` with subsetting.
- **[TESTING]** Guard performance in CI with Lighthouse CI budgets on key pages and size-limit checks on bundles, and verify that optimizations keep behavior identical through existing tests.
- **[REFERENCE]** See `references/vue-performance.md` for reference anti-patterns and best practices.

### 5. Vue Security (`vue-security`)

*Scope:* Security for Vue and Nuxt applications: template auto-escaping and the dangers of v-html, dynamic URLs and attribute bindings, never compiling user templates, CSP, secrets and runtimeConfig, cookie sessions with CSRF protection, the BFF pattern for tokens, SSR state leaks, route guards as UX only, and dependency hygiene. Use it when implementing or reviewing security in Vue or Nuxt code.

- **[MANDATORY]** Render untrusted data only through text interpolation (`{{ }}`) and normal attribute bindings, which Vue escapes; treat `v-html`, `innerHTML`, and render functions that set `innerHTML` as dangerous sinks.
- **[FORBIDDEN]** `v-html` with user or API-provided content that is not sanitized, compiling templates from user input (runtime compiler with dynamic `template` strings), `eval`/`new Function`, and binding user-controlled values to `on*` attributes or `:is` component names without an allow-list.
- **[SECURITY]** When rich HTML must be displayed, sanitize it with a maintained sanitizer (DOMPurify with a strict allow-list), ideally on the server when the content is stored and again at render time.
- **[SECURITY]** Validate dynamic URLs bound to `href`/`src`: allow only `https:` (and `mailto:` where needed) or relative paths, rejecting `javascript:` and `data:` schemes, and add `rel="noopener noreferrer"` to external links opened in new tabs.
- **[SECURITY]** Deploy a Content Security Policy without `unsafe-eval` (use the runtime-only Vue build) and with nonces or hashes for inline scripts; in Nuxt configure it through a security module (for example `nuxt-security`) and report violations.
- **[MANDATORY]** No secrets in client code: everything bundled into the browser is public. In Nuxt, keep secrets in private `runtimeConfig` and call third-party APIs from server routes.
- **[PATTERN]** Authenticate with `HttpOnly`, `Secure`, `SameSite` session cookies via a Backend-for-Frontend (Nuxt server routes are a natural BFF), with CSRF protection for state-changing requests (SameSite plus a CSRF token or origin checks); do not store tokens in `localStorage`.
- **[MANDATORY]** Router guards (`beforeEach`, Nuxt route middleware) only improve user experience; every permission is enforced by the API, and the UI handles 401/403 responses.
- **[SECURITY]** In SSR, never keep per-user data in module-level variables or singletons shared across requests; use `useState`, request context (`event.context`), or per-request Pinia instances, and do not serialize sensitive fields into the page payload.
- **[SECURITY]** Validate every Nitro server route input with a schema, return minimal fields, and apply rate limiting and security headers on the server.
- **[MANDATORY]** Keep Vue, Nuxt, and dependencies up to date, run an SCA check (`npm audit` or equivalent) in CI, and lint with rules that flag `v-html` (`vue/no-v-html`) so every use is reviewed.
- **[TESTING]** Tests render XSS payloads through components and assert they appear as text, check that unsafe URLs are rejected, and verify that server routes reject invalid input and unauthorized requests.
- **[REFERENCE]** See `references/vue-security.md` for reference anti-patterns and best practices.

### 6. Vue Testing with Vitest (`vue-testing-vitest`)

*Scope:* Testing Vue 3 and Nuxt applications with Vitest: component tests with Vue Testing Library or Vue Test Utils, testing composables, Pinia testing, mocking HTTP with MSW, fake timers, Nuxt tests with @nuxt/test-utils, Vitest browser mode, and end-to-end tests with Playwright. Use it when writing or reviewing tests for Vue code.

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
- **[REFERENCE]** See `references/vue-testing-vitest.md` for reference anti-patterns and best practices.

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
