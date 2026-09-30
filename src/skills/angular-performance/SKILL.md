---
name: angular-performance
description: "Performance for Angular applications: OnPush and zoneless change detection, signals, @defer blocks, lazy routes, bundle budgets and analysis, NgOptimizedImage, SSR with incremental hydration, @for tracking, virtual scrolling, and Core Web Vitals measurement. Use it when optimizing or reviewing the runtime and loading performance of Angular apps."
---

# Skill: Angular Performance

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
