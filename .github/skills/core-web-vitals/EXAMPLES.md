# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Slow LCP, janky input, shifting layout
```html
<head>
  <script src="https://tags.example-analytics.com/all.js"></script>        <!-- render-blocking third party -->
  <link href="https://fonts.example.net/css?family=Brand" rel="stylesheet">
</head>
<body>
  <div id="root"></div>                                                      <!-- hero rendered only after 900 KB of JS -->
  <img src="/hero.jpg" loading="lazy">                                       <!-- LCP image lazy, no dimensions -->
  <script>
    searchInput.addEventListener('input', e => renderResults(filterAll(products, e.target.value)));   // 300 ms task per keystroke
  </script>
</body>
```
**Why it's wrong:**
- The hero appears only after large JavaScript executes, and the LCP image is lazy with no reserved space (CLS).
- Every keystroke runs a long task, producing poor INP; a blocking third-party script delays everything.

## Best Practice (How to do it right)

### 1. Discoverable, prioritized LCP and stable layout
```html
<head>
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="preload" as="font" href="/fonts/brand-var.woff2" type="font/woff2" crossorigin>
  <style>/* inlined critical CSS */ @font-face { font-family: Brand; src: url(/fonts/brand-var.woff2) format("woff2"); font-display: optional; }</style>
  <script src="/js/app.4c1e.js" type="module" defer></script>
</head>
<body>
  <img src="https://cdn.example.com/hero-1200.avif" width="1200" height="600"
       fetchpriority="high" alt="Autumn collection: trail shoes on a forest path">
</body>
```
### 2. Keeping interactions responsive
```javascript
let pending;
searchInput.addEventListener('input', (e) => {
  clearTimeout(pending);
  pending = setTimeout(() => worker.postMessage({ query: e.target.value }), 150);   // debounce, filter in a worker
});
worker.onmessage = ({ data }) => requestAnimationFrame(() => renderResults(data.results));
```
### 3. Field measurement with attribution
```javascript
import { onLCP, onINP, onCLS } from 'web-vitals/attribution';

function send(metric) {
  navigator.sendBeacon('/rum', JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating, page: location.pathname,
    release: window.__RELEASE__, attribution: metric.attribution,
  }));
}
onLCP(send); onINP(send); onCLS(send);
```
**Why it's right:**
- The LCP image is in the initial HTML with high priority and fixed dimensions; fonts do not cause late shifts.
- Input work is debounced and moved off the main thread, and real-user vitals with attribution are collected per release.
