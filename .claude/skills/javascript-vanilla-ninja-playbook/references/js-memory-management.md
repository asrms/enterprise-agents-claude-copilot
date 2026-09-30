# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Stock ticker widget with listeners, timers, and observers
```javascript
// src/widgets/stock-ticker.js
export function mountStockTicker(container, symbol) {
  const panel = document.createElement('section');
  container.append(panel);

  window.addEventListener('resize', () => layout(panel));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  setInterval(refresh, 5000);                                  // id not saved: impossible to stop

  const observer = new ResizeObserver(() => layout(panel));
  observer.observe(panel);

  async function refresh() {
    const res = await fetch(`/api/quotes/${symbol}`);
    panel.textContent = (await res.json()).price;              // keeps updating a removed node
  }

  return {
    destroy() {
      panel.remove();                                          // listeners, interval, and observer stay alive
      window.removeEventListener('resize', () => layout(panel)); // different function: removes nothing
    },
  };
}

function layout(panel) {
  panel.classList.toggle('compact', panel.clientWidth < 320);
}
```
**Why it's wrong:** the interval, global listeners, and observer survive `destroy()` and retain `panel` and the closure, creating a detached DOM for every mount; `removeEventListener` receives a new arrow function and removes nothing; polling continues in the background and on unmounted widgets; in-flight fetches are not canceled.

### 2. Table row metadata
```javascript
// src/table/order-table.js
const rowData = new Map();                    // strong references to <tr> nodes
const selectedRows = [];

export function renderRows(tbody, orders) {
  tbody.innerHTML = '';                       // old <tr>s leave the DOM but stay in rowData
  for (const order of orders) {
    const tr = document.createElement('tr');
    tr.textContent = order.number;
    tr.__order = order;                       // expando property on the node
    rowData.set(tr, { order, expanded: false });
    tr.addEventListener('click', () => {
      selectedRows.push(tr);                  // grows forever and retains detached nodes
      tr.classList.toggle('selected');
    });
    tbody.appendChild(tr);
  }
}
// after 50 refreshes of 1,000 rows: 50,000 "Detached HTMLTableRowElement" in the heap snapshot
```
**Why it's wrong:** the `Map` keyed by nodes and the `selectedRows` array prevent removed rows from being collected, so every refresh adds an entire detached tree; the `__order` expando ties domain data to the DOM; one listener per row multiplies closures and memory; the selection does not survive re-rendering because it is tied to nodes rather than ids.

### 3. Product cache and long-lived closures
```javascript
// src/catalog/product-cache.js
const cache = {};                                    // grows without limit for the entire session

export async function getProduct(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(`/api/products/${id}`);
  const payload = await res.json();                  // base64 images, reviews, and variants: about 2 MB
  cache[id] = payload;
  return payload;
}

export async function trackProductView(id) {
  const payload = await getProduct(id);
  // long-lived closure that retains the entire payload to read a single field
  setInterval(() => {
    navigator.sendBeacon('/analytics/heartbeat', JSON.stringify({ sku: payload.sku }));
  }, 30000);                                         // never stopped, even after leaving the product page
}
```
**Why it's wrong:** after visiting 300 products the cache retains about 600 MB with no expiry; the interval has no cleanup and accumulates on every view; the closure keeps the entire payload alive when only the SKU is needed; an object literal used as a dictionary is also exposed to collisions with keys such as `__proto__`.

## Best Practice (How to do it right)

### 1. Stock ticker widget with listeners, timers, and observers
```javascript
// src/features/widgets/stock-ticker.js
// @ts-check

/**
 * @param {HTMLElement} container
 * @param {string} symbol
 * @param {{ fetchQuote: (symbol: string, signal: AbortSignal) => Promise<{ price: number }>, intervalMs?: number }} deps
 * @returns {{ destroy: () => void }}
 */
export function mountStockTicker(container, symbol, { fetchQuote, intervalMs = 5000 }) {
  const controller = new AbortController();                 // a single switch for all resources
  const { signal } = controller;
  const panel = document.createElement('section');
  container.append(panel);

  const observer = new ResizeObserver(() => panel.classList.toggle('compact', panel.clientWidth < 320));
  observer.observe(panel);

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timerId;

  async function tick() {
    if (signal.aborted || document.visibilityState === 'hidden') return;
    try {
      const { price } = await fetchQuote(symbol, signal);   // canceled by destroy()
      panel.textContent = price.toFixed(2);
    } catch {
      if (!signal.aborted) panel.dataset.state = 'error';
    } finally {
      if (!signal.aborted) timerId = setTimeout(() => void tick(), intervalMs); // polling only while mounted
    }
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timerId);                                   // no polling while the tab is hidden
    if (document.visibilityState === 'visible') void tick();
  }, { signal });
  void tick();

  return {
    destroy() {
      controller.abort();                                    // removes listeners and cancels the in-flight fetch
      clearTimeout(timerId);
      observer.disconnect();
      panel.remove();
    },
  };
}
```
**Why it's right:** a single `AbortController` removes the listeners registered with `{ signal }` and cancels the in-flight request; polling with a recursive `setTimeout` stops on abort and pauses while the tab is hidden; the `ResizeObserver` is explicitly disconnected; after `destroy()` no reference to `panel` remains reachable.

### 2. Table row metadata
```javascript
// src/features/orders/order-table.js
// @ts-check

/** @typedef {{ id: string, number: string, totalCents: number }} Order */

/** @type {WeakMap<HTMLTableRowElement, { order: Order, expanded: boolean }>} */
const rowState = new WeakMap(); // the entry is collected together with the row

/**
 * @param {HTMLTableSectionElement} tbody
 * @param {AbortSignal} signal
 */
export function createOrderTable(tbody, signal) {
  /** @type {Set<string>} */
  const selectedIds = new Set(); // ids are stored, not nodes

  tbody.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const tr = event.target.closest('tr');
    const state = tr && rowState.get(tr);
    if (!tr || !state) return;
    const selected = !selectedIds.delete(state.order.id);
    if (selected) selectedIds.add(state.order.id);
    tr.classList.toggle('selected', selected);
  }, { signal });

  return {
    /** @param {readonly Order[]} orders */
    render(orders) {
      const currentIds = new Set(orders.map((order) => order.id));
      for (const id of selectedIds) if (!currentIds.has(id)) selectedIds.delete(id); // no unbounded growth
      const rows = orders.map((order) => {
        const tr = document.createElement('tr');
        tr.textContent = order.number;
        tr.classList.toggle('selected', selectedIds.has(order.id));
        rowState.set(tr, { order, expanded: false });
        return tr;
      });
      tbody.replaceChildren(...rows); // previous rows become collectable
    },
    getSelectedIds: () => [...selectedIds],
  };
}
```
**Why it's right:** the `WeakMap` does not prevent replaced rows from being collected; the selection is stored as a set of ids, survives re-rendering, and is pruned on every update; a single delegated listener, removed via `signal`, replaces thousands of closures; no expando properties on nodes.

### 3. Product cache and long-lived closures
```javascript
// src/shared/cache/lru-cache.js
// @ts-check

/**
 * LRU cache bounded by number of entries and TTL: Map preserves insertion order.
 * @template K, V
 */
export class LruCache {
  /** @type {Map<K, { value: V, expiresAt: number }>} */
  #entries = new Map();

  /** @param {{ maxEntries: number, ttlMs: number, now?: () => number }} options */
  constructor({ maxEntries, ttlMs, now = Date.now }) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  /**
   * @param {K} key
   * @returns {V | undefined}
   */
  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;  // expired: stays removed
    this.#entries.set(key, entry);                        // re-inserted at the end: recently used
    return entry.value;
  }

  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    this.#entries.delete(key);
    this.#entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    for (const oldestKey of this.#entries.keys()) {       // the first keys are the least recently used
      if (this.#entries.size <= this.maxEntries) break;
      this.#entries.delete(oldestKey);
    }
  }

  clear() { this.#entries.clear(); }
}

// --- src/features/catalog/product-tracking.js ---
/**
 * Captures only the SKU, not the full payload; the interval stops with the signal.
 * @param {{ sku: string }} product
 * @param {AbortSignal} signal
 */
export function trackProductView({ sku }, signal) {
  const intervalId = setInterval(() => {
    navigator.sendBeacon('/analytics/heartbeat', JSON.stringify({ sku }));
  }, 30_000);
  signal.addEventListener('abort', () => clearInterval(intervalId), { once: true });
}
```
**Why it's right:** the cache has an entry limit (for example `new LruCache({ maxEntries: 200, ttlMs: 5 * 60_000 })`) and an expiry, and keeps only the fields used by the UI instead of the full payload; `Map` avoids collisions with prototype keys; the interval's closure captures only the SKU and the timer is cleared when the product view is unmounted; `clear()` allows the data to be wiped on logout.
