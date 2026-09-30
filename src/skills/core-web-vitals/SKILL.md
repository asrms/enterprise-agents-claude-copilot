---
name: core-web-vitals
description: "Optimizing web page performance and Core Web Vitals: Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift, measured with field data (CrUX, RUM with the web-vitals library) and lab tools (Lighthouse, WebPageTest, DevTools), plus techniques for server response time, critical rendering path, images and fonts, JavaScript cost, long tasks, and layout stability. Use it when improving or reviewing frontend loading and responsiveness for any web framework."
---

# Skill: Core Web Vitals

## Implementation Rules:
- **[MANDATORY]** Target the "good" thresholds at the 75th percentile of real users, segmented by mobile and desktop: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less.
- **[MANDATORY]** Measure field data, not only lab scores: collect real user monitoring with the `web-vitals` library (with attribution) sent to your analytics or observability backend, and check Chrome UX Report data for public pages; use Lighthouse and WebPageTest to diagnose.
- **[PERFORMANCE]** Improve LCP: fast server response (TTFB under about 800 ms via caching, CDN, and efficient backends), the LCP element discoverable in the initial HTML (no client-side-only rendering of hero content), `fetchpriority="high"` on the LCP image and no lazy loading for it, preconnect to critical origins, and optimized image formats and sizes.
- **[PERFORMANCE]** Improve INP: break up long tasks (over 50 ms) with yielding (`scheduler.yield()` where supported, or `setTimeout`/`requestAnimationFrame` splitting), reduce JavaScript executed on interaction, debounce expensive handlers, avoid layout thrashing, move heavy work to Web Workers, and minimize hydration cost.
- **[PERFORMANCE]** Improve CLS: reserve space for images, videos, iframes, and ads (`width`/`height` or `aspect-ratio`), avoid inserting content above existing content, use `font-display: optional` or size-adjusted fallback fonts to reduce font swap shifts, and animate with `transform` instead of layout properties.
- **[PATTERN]** Reduce JavaScript and CSS on the critical path: code splitting by route, removing unused dependencies, deferring third-party scripts, inlining critical CSS for above-the-fold content, and serving modern bundles compressed with Brotli.
- **[PATTERN]** Use rendering strategies that suit the page: static generation or server rendering with streaming for content pages, with partial or islands hydration where the framework supports it.
- **[FORBIDDEN]** Lazy loading the LCP image, client-side rendering of the main content of landing pages without server rendering, synchronous third-party scripts in the document head, layout-shifting cookie banners and ads, and optimizing for Lighthouse scores while field data is poor.
- **[PATTERN]** Govern third-party scripts: inventory, owner, and measured cost for each tag, loaded with `async` or `defer` or after consent and interaction, and removed when unused.
- **[PATTERN]** Attribute regressions to changes: track vitals per release and per page template, and use attribution data (LCP element, INP target and phase, CLS sources) to find the cause.
- **[TESTING]** Enforce budgets in CI with Lighthouse CI (performance assertions and resource budgets) on key templates, and alert when field p75 values regress beyond thresholds after a release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
