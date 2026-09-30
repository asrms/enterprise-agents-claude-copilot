---
name: js-dom-performance
description: "DOM performance in vanilla JavaScript: event delegation, reads/writes without layout thrashing, requestAnimationFrame, DocumentFragment and templates, passive listeners, IntersectionObserver, debounce, content-visibility, Web Workers, and import(). Use it for lists, scrolling, animations, and jank."
---

# Skill: DOM and Main Thread Performance

## Implementation Rules:
- **[ARCHITECTURE]** Separate state from rendering: state changes mark the view as dirty and a single `requestAnimationFrame` callback applies all DOM writes for the frame; never one DOM manipulation per event or per modified element.
- **[MANDATORY]** Use event delegation for lists, tables, and menus: a single listener on the container resolves the target with `event.target.closest('[data-action]')` and checks `container.contains(match)`; registering one listener per row or per cell is forbidden.
- **[MANDATORY]** Within the same frame, perform all layout reads first (`getBoundingClientRect()`, `offsetWidth`/`offsetHeight`, `clientWidth`, `scrollTop`, `getComputedStyle()`) and only then all writes (`style`, `classList`, node insertions and removals).
- **[FORBIDDEN]** Interleaving layout writes and reads in a loop (`el.style.height = 'auto'; el.offsetHeight`): every read after a write forces a synchronous layout, flagged by the DevTools Performance panel as "Forced reflow".
- **[FORBIDDEN]** `innerHTML +=` or `appendChild()` in a loop on an already connected node: the former reparses and recreates the entire content on every iteration (O(n²) cost and lost listeners), the latter invalidates style and layout on every insertion.
- **[PATTERN]** Build multiple insertions off-document in a `DocumentFragment` and apply them with a single `container.append(fragment)` or `container.replaceChildren(...nodes)` call.
- **[PATTERN]** Define repeated markup in a `<template>` and instantiate it with `template.content.cloneNode(true)`, populating fields with `textContent`, `dataset`, and properties: HTML parsing happens only once.
- **[PERFORMANCE]** Register `touchstart`, `touchmove`, and `wheel` listeners with `{ passive: true }` when they do not call `preventDefault()`, so scrolling does not wait for the main thread; use `{ passive: false }` only where blocking is essential (custom drag or pinch).
- **[FORBIDDEN]** `scroll` handlers that compute visibility with `getBoundingClientRect()` for lazy loading, infinite scroll, analytics impressions, or sticky headers: use `IntersectionObserver` with `rootMargin` (e.g. `'0px 0px 400px 0px'`) and `threshold`, calling `unobserve()` when the target is no longer needed.
- **[PATTERN]** Images with `loading="lazy"`, `decoding="async"`, and explicit `width`/`height` to prevent layout shift; no JavaScript lazy-loading libraries for images.
- **[PATTERN]** Debounce search inputs and expensive validations by 250-300 ms; throttle `scroll`, `pointermove`, and `resize` to the frame with `requestAnimationFrame`; observe element dimensions with `ResizeObserver` instead of `window.addEventListener('resize')`.
- **[PERFORMANCE]** Give long off-viewport sections `content-visibility: auto` and `contain-intrinsic-size: auto 500px` to skip their layout and paint (Chrome 85+, Firefox 125+, Safari 18+); for lists beyond roughly 1,000 rows use virtualization (render only the visible rows plus a buffer).
- **[PERFORMANCE]** Animate only `transform` and `opacity`, handled by the compositor, via CSS transitions or `element.animate()`; animating `top`, `left`, `width`, `height`, or `margin` is forbidden; apply `will-change` only for the duration of the animation.
- **[PERFORMANCE]** No main-thread task over 50 ms: run CPU-bound computations (parsing large CSV/JSON, filtering and sorting over 10,000 records, diffing, compression) in a Web Worker `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`, transferring `ArrayBuffer`s in the `postMessage` transfer list.
- **[PERFORMANCE]** Split long but divisible main-thread work into chunks, yielding control with `scheduler.yield()` (Chromium 129+, not universally supported) with an `await new Promise((resolve) => setTimeout(resolve, 0))` fallback.
- **[PERFORMANCE]** Load non-critical code (editors, charts, complex modals) with dynamic `import()` on interaction or visibility; preload critical-path modules with `<link rel="modulepreload" href="/src/main.js">`.
- **[SECURITY]** Optimizations must not introduce dangerous sinks: templates and fragments are populated with `textContent` and `setAttribute()`, never by interpolating data into HTML strings "to go faster".
- **[TESTING]** Measure before and after every optimization: Chrome DevTools Performance panel (long tasks, forced reflows, layout shifts), `PerformanceObserver` with `type: 'long-animation-frame'` (Chrome 123+) or `'longtask'`, Core Web Vitals targets INP < 200 ms and CLS < 0.1.
- **[TESTING]** Test debounce, throttle, and schedulers with `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })` and `vi.advanceTimersByTime()`, with no real waits.
- **[CONFIGURATION]** With Vite, keep `build.modulePreload` enabled (default), analyze chunks with `rollup-plugin-visualizer`, and define a budget for initial JavaScript (e.g. 100 KB gzip) enforced in CI with `size-limit`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
