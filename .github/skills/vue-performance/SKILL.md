---
name: vue-performance
description: "Runtime and loading performance for Vue 3 and Nuxt: fine-grained reactivity with computed and shallowRef, stable keys, v-memo and v-once, async components and route-level code splitting, virtual lists, avoiding expensive watchers, bundle analysis with Vite, image optimization, and measuring Core Web Vitals. Use it when optimizing or reviewing Vue application performance."
---

# Skill: Vue Performance

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
