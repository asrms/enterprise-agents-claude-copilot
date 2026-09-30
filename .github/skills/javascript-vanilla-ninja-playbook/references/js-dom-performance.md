# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Rendering a product list
```javascript
// src/catalog/product-list.js
export function renderProducts(container, products, onAddToCart) {
  container.innerHTML = '';
  for (const product of products) {
    // every += reparses and recreates the entire container content
    container.innerHTML += `
      <li class="product">
        <h3>${product.name}</h3>
        <span class="price">${product.price} €</span>
        <button class="add">Add</button>
      </li>`;
  }
  // one listener per row, registered again on every render
  container.querySelectorAll('.product').forEach((li, index) => {
    li.querySelector('.add').addEventListener('click', () => {
      onAddToCart(products[index]); // the closure retains the entire products array
    });
  });
}
```
**Why it's wrong:** `innerHTML +=` in a loop has quadratic cost and with 5,000 products blocks the main thread for seconds; thousands of listeners and closures are recreated on every render; interpolating `product.name` into HTML opens the door to XSS; the price is not formatted according to the locale.

### 2. Equalizing card heights
```javascript
// src/dashboard/equalize-cards.js
export function equalizeCardHeights(cards) {
  cards.forEach((card) => {
    card.style.height = 'auto';                    // write: invalidates layout
    const height = card.offsetHeight;              // read: forces a synchronous layout
    card.style.height = `${height + 16}px`;        // write: invalidates again
  });
}

export function slidePanel(panel) {
  let left = 0;
  const timer = setInterval(() => {
    left += 4;
    panel.style.left = `${left}px`;                // animates a layout property
    if (left >= panel.parentElement.offsetWidth) clearInterval(timer); // read on every tick
  }, 16);
}

window.addEventListener('resize', () => {
  // dozens of runs per second, each with N forced reflows
  equalizeCardHeights(document.querySelectorAll('.card'));
});
```
**Why it's wrong:** interleaving writes and reads in the loop causes a forced reflow for every card (layout thrashing); the window `resize` event fires dozens of times per second and does not catch container size changes; animating `left` with `setInterval` recalculates layout on every tick and is not synchronized with the screen refresh.

### 3. Infinite scroll and lazy loading
```javascript
// src/feed/infinite-feed.js
import { trackGesture } from '../analytics/gestures.js';

let page = 1;
let loading = false;

window.addEventListener('scroll', async () => {
  const sentinel = document.querySelector('#feed-end');
  const rect = sentinel.getBoundingClientRect();           // forced layout on every scroll event
  if (rect.top < window.innerHeight + 400 && !loading) {
    loading = true;
    const res = await fetch(`/api/feed?page=${++page}`);
    const posts = await res.json();
    posts.forEach((post) => {
      document.querySelector('#feed').innerHTML += `<article>${post.body}</article>`;
    });
    loading = false;                                        // if the fetch fails it stays true forever
  }
});

document.querySelector('#feed').addEventListener('touchmove', (event) => {
  trackGesture(event.touches[0]);                           // non-passive listener: scrolling waits for JS
});

document.querySelectorAll('img[data-src]').forEach((img) => {
  // one scroll listener per image, never removed
  window.addEventListener('scroll', () => {
    if (img.getBoundingClientRect().top < window.innerHeight) img.src = img.dataset.src;
  });
});
```
**Why it's wrong:** every `scroll` event runs `getBoundingClientRect()` on the sentinel and images, forcing layout dozens of times per second; `touchmove` on an element without `passive: true` can delay scrolling on mobile; network errors block the feed forever and no listener is ever removed; `innerHTML +=` reparses the entire feed and inserts unsanitized HTML.

## Best Practice (How to do it right)

### 1. Rendering a product list
```javascript
// src/features/catalog/product-list.js
// @ts-check
// <template id="product-row">
//   <li class="product"><h3 class="name"></h3><span class="price"></span>
//   <button type="button" data-action="add">Add</button></li>
// </template>

/** @typedef {{ id: string, name: string, priceCents: number }} Product */

const priceFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/**
 * @param {ParentNode} root
 * @param {string} selector
 */
const field = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));

/**
 * @param {HTMLTemplateElement} template
 * @param {readonly Product[]} products
 * @returns {DocumentFragment} rows built off-document
 */
export function buildProductRows(template, products) {
  const fragment = document.createDocumentFragment();
  for (const product of products) {
    const row = /** @type {DocumentFragment} */ (template.content.cloneNode(true));
    const li = /** @type {HTMLLIElement} */ (row.firstElementChild);
    li.dataset.productId = product.id;
    field(li, '.name').textContent = product.name;            // text, never interpolated HTML
    field(li, '.price').textContent = priceFormatter.format(product.priceCents / 100);
    fragment.append(row);
  }
  return fragment;
}

/**
 * A single delegated listener for the entire list, registered once.
 * @param {HTMLUListElement} list
 * @param {(productId: string) => void} onAddToCart
 * @param {AbortSignal} signal
 */
export function bindProductList(list, onAddToCart, signal) {
  list.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button[data-action="add"]');
    if (!button || !list.contains(button)) return;
    const productId = button.closest('li')?.dataset.productId;
    if (productId) onAddToCart(productId);
  }, { signal });
}

/**
 * @param {HTMLUListElement} list
 * @param {DocumentFragment} rows
 */
export function renderProducts(list, rows) {
  list.replaceChildren(rows); // a single insertion: a single style and layout recalculation
}
```
**Why it's right:** the template is parsed only once and cloned; all rows enter the document with a single `replaceChildren()`; one delegated listener serves any number of rows, including ones added later, and is removed via the `signal`; data flows through `textContent` and `Intl.NumberFormat`, with no XSS risk.

### 2. Equalizing card heights
```javascript
// src/features/dashboard/equalize-cards.js
// @ts-check

/**
 * Batched reads and writes: a single layout per call.
 * @param {readonly HTMLElement[]} cards
 */
export function equalizeCardHeights(cards) {
  if (cards.length === 0) return;
  for (const card of cards) card.style.height = 'auto';        // phase 1: reset writes
  const heights = cards.map((card) => card.offsetHeight);       // phase 2: reads (a single layout)
  const target = Math.max(...heights) + 16;
  for (const card of cards) card.style.height = `${target}px`;  // phase 3: writes
}

/**
 * Runs fn at most once per frame with the latest arguments received.
 * @template {unknown[]} A
 * @param {(...args: A) => void} fn
 * @returns {(...args: A) => void}
 */
export function rafThrottle(fn) {
  let frameId = 0;
  /** @type {A | undefined} */
  let lastArgs;
  return (...args) => {
    lastArgs = args;
    if (frameId) return;
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      if (lastArgs) fn(...lastArgs);
    });
  };
}

/**
 * @param {HTMLElement} panel
 * @param {number} distancePx distance measured once before animating
 */
export function slidePanel(panel, distancePx) {
  return panel.animate(                                          // transform only: handled by the compositor
    [{ transform: 'translateX(0)' }, { transform: `translateX(${distancePx}px)` }],
    { duration: 300, easing: 'ease-out', fill: 'forwards' },
  );
}

/**
 * @param {HTMLElement} grid
 * @param {AbortSignal} signal
 */
export function watchGrid(grid, signal) {
  const update = rafThrottle(() =>
    equalizeCardHeights(/** @type {HTMLElement[]} */ ([...grid.querySelectorAll('.card')])));
  const observer = new ResizeObserver(update);                   // reacts to the container, not the window
  observer.observe(grid);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
```
**Why it's right:** reads are grouped between two write phases, so the browser computes layout only once; `ResizeObserver` plus `rafThrottle` limit recalculation to one per frame and also react to container changes; `element.animate()` on `transform` runs on the compositor with no per-frame layout; whenever possible, still prefer CSS Grid with `grid-auto-rows: 1fr`, which eliminates the JavaScript entirely.

### 3. Infinite scroll and lazy loading
```javascript
// src/features/feed/infinite-feed.js
// @ts-check
import { trackGesture } from '../analytics/gestures.js';
import { buildPostNodes } from './post-template.js'; // DocumentFragment from <template>, img with loading="lazy"

/**
 * @param {{
 *   feed: HTMLElement,
 *   sentinel: HTMLElement,
 *   loadPage: (page: number, signal: AbortSignal) => Promise<{ id: string, body: string }[]>,
 *   onError: (error: unknown) => void,
 *   signal: AbortSignal,
 * }} options
 */
export function setupInfiniteFeed({ feed, sentinel, loadPage, onError, signal }) {
  let page = 1;
  let loading = false;

  const loadNext = async () => {
    loading = true;
    try {
      const posts = await loadPage(page + 1, signal);
      page += 1;
      if (posts.length === 0) {
        observer.disconnect();                 // end of the feed
        return;
      }
      feed.append(buildPostNodes(posts));      // a single insertion per page
      observer.unobserve(sentinel);            // re-observe: if the sentinel is still visible
      observer.observe(sentinel);              // the observer sends a new notification
    } catch (error) {
      if (!signal.aborted) onError(error);
    } finally {
      loading = false;
    }
  };

  const observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting && !loading) void loadNext();
  }, { rootMargin: '0px 0px 400px 0px' });      // preload 400px before the bottom
  observer.observe(sentinel);

  feed.addEventListener('touchmove', (event) => trackGesture(event.touches[0]), { passive: true, signal });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
```
**Why it's right:** `IntersectionObserver` computes visibility off the main thread without reading layout on every scroll; images use native lazy loading instead of dedicated listeners; the `touchmove` listener is `passive` and everything is removed via `signal`; errors are handled and `finally` always resets the loading state.
