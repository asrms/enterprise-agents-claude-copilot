# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Cart store shared across modules
```javascript
// src/cart/cart.js
window.cart = { items: [], total: 0 };

export default function addToCart(product, qty) {
  const existing = window.cart.items.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += qty; // direct mutation of shared state
  } else {
    window.cart.items.push({ ...product, qty });
  }
  window.cart.total = window.cart.items.reduce((s, i) => s + i.price * i.qty, 0);

  // domain logic mixed with DOM, persistence, and global events
  document.querySelector('#cart-count').innerText = window.cart.items.length;
  localStorage.setItem('cart', JSON.stringify(window.cart));
  window.dispatchEvent(new Event('cart-changed'));
}

export function removeFromCart(id) {
  window.cart.items = window.cart.items.filter((i) => i.id !== id);
  window.cart.total = window.cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  document.querySelector('#cart-count').innerText = window.cart.items.length;
}
```
**Why it's wrong:** state on `window` can be modified by any script, including third-party ones, without notification; the logic cannot be tested without the DOM and `localStorage`; the total is duplicated derived state that can drift out of sync (it is not persisted in `removeFromCart`); `export default` and the lack of types make imports and refactoring fragile.

### 2. Order service with hidden dependencies
```javascript
// src/services/order-service.js
import { apiClient } from '../api/client.js'; // singleton with global token and baseUrl
import { showToast } from '../ui/toast.js';
import { cartStore } from '../cart/cart.js';

export async function submitOrder() {
  const cart = cartStore.get();
  const order = {
    id: 'ord_' + Math.random().toString(36).slice(2), // non-deterministic, collisions possible
    createdAt: new Date().toISOString(),              // tests depend on the system clock
    items: cart.items,
    total: cart.items.reduce((s, i) => s + i.price * i.qty, 0),
  };
  try {
    const res = await apiClient.post('/orders', order);
    showToast('Order submitted!');                    // UI side effect inside the service
    localStorage.removeItem('cart');
    return res;
  } catch (e) {
    showToast('Error');                               // swallowed error: the caller receives undefined
  }
}
```
**Why it's wrong:** dependencies are hidden in the imports and testing requires three `vi.mock()` calls; non-deterministic ids and timestamps make tests flaky; the service knows about UI and storage, violating layer separation; the error is swallowed and the caller cannot react.

### 3. Event bus between features
```javascript
// src/shared/events.js
export function emit(name, data) {
  document.dispatchEvent(new CustomEvent(name, { detail: data }));
}

export function on(name, callback) {
  document.addEventListener(name, (e) => callback(e.detail)); // impossible to remove
}

// src/features/search/search-view.js
import { emit } from '../../shared/events.js';

export function bindSearch(input) {
  input.addEventListener('input', () => emit('searchChanged', { q: input.value }));
}

// src/features/results/results-view.js
import { on } from '../../shared/events.js';

export function bindResults(render) {
  // event name and payload differ from the emitted ones: no error, it just doesn't work
  on('search-changed', ({ query }) => render(query));
}
```
**Why it's wrong:** a typo in the event name or payload fails silently; the event contract is neither documented nor verified; listeners cannot be removed and pile up on every `bindResults` call; `document` is shared with native events and external scripts, risking collisions.

## Best Practice (How to do it right)

### 1. Cart store shared across modules
```javascript
// src/features/cart/cart-store.js
// @ts-check

/** @typedef {import('./types.js').CartItem} CartItem */
/** @typedef {{ items: readonly CartItem[] }} CartState */
/** @typedef {{ type: 'item/added', item: CartItem } | { type: 'item/removed', id: string }} CartAction */

/**
 * Pure reducer: no mutation, no I/O, testable in the node environment.
 * @param {CartState} state
 * @param {CartAction} action
 * @returns {CartState}
 */
export function cartReducer(state, action) {
  switch (action.type) {
    case 'item/added': {
      const index = state.items.findIndex((i) => i.id === action.item.id);
      if (index === -1) return { items: [...state.items, action.item] };
      const current = state.items[index];
      return { items: state.items.with(index, { ...current, qty: current.qty + action.item.qty }) };
    }
    case 'item/removed':
      return { items: state.items.filter((i) => i.id !== action.id) };
    default:
      return state;
  }
}

/** @param {CartState} state */
export const selectTotalCents = (state) => state.items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);

export class CartStore extends EventTarget {
  /** @type {Readonly<CartState>} */
  #state;
  /** @param {CartState} [initialState] */
  constructor(initialState = { items: [] }) {
    super();
    this.#state = Object.freeze(initialState);
  }

  getState() { return this.#state; } // frozen snapshot: consumers cannot mutate it

  /** @param {CartAction} action */
  dispatch(action) {
    const next = cartReducer(this.#state, action);
    if (next === this.#state) return;
    this.#state = Object.freeze(next);
    this.dispatchEvent(new CustomEvent('change', { detail: this.#state }));
  }

  /**
   * @param {(state: CartState) => void} listener
   * @returns {() => void} unsubscribe function
   */
  subscribe(listener) {
    const handler = (/** @type {Event} */ event) => listener(/** @type {CustomEvent<CartState>} */ (event).detail);
    this.addEventListener('change', handler);
    return () => this.removeEventListener('change', handler);
  }
}
```
**Why it's right:** state is encapsulated in a private field and exposed only as a frozen snapshot; the pure reducer uses `Array.prototype.with()` (ES2023) without mutation and is testable without the DOM; the total is a derived selector, not duplicated state; persistence and rendering become subscribers wired in the composition root.

### 2. Order service with hidden dependencies
```javascript
// src/features/checkout/order-service.js
// @ts-check

/** @typedef {import('../cart/types.js').CartItem} CartItem */
/**
 * @typedef {object} OrderServiceDeps
 * @property {typeof fetch} fetchFn
 * @property {string} baseUrl
 * @property {() => Date} now
 * @property {() => string} generateId
 */

/**
 * Pure function: builds the order payload from explicit data.
 * @param {readonly CartItem[]} items
 * @param {{ id: string, createdAt: Date }} meta
 */
export function buildOrder(items, { id, createdAt }) {
  return {
    id,
    createdAt: createdAt.toISOString(),
    lines: items.map(({ id: sku, qty, priceCents }) => ({ sku, qty, priceCents })),
    totalCents: items.reduce((sum, i) => sum + i.priceCents * i.qty, 0),
  };
}

/** @param {OrderServiceDeps} deps */
export function createOrderService({ fetchFn, baseUrl, now, generateId }) {
  return {
    /** @param {readonly CartItem[]} items */
    async submit(items) {
      const order = buildOrder(items, { id: generateId(), createdAt: now() });
      const response = await fetchFn(new URL('/orders', baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': order.id },
        body: JSON.stringify(order),
      });
      if (!response.ok) throw new Error(`Order submission failed: HTTP ${response.status}`);
      return /** @type {{ orderId: string }} */ (await response.json());
    },
  };
}

// --- src/main.js (composition root: the only module that knows the concrete implementations) ---
import { createOrderService } from './features/checkout/order-service.js';
import { mountCheckout } from './features/checkout/checkout-view.js';

const orderService = createOrderService({
  fetchFn: globalThis.fetch.bind(globalThis),
  baseUrl: location.origin,
  now: () => new Date(),
  generateId: () => crypto.randomUUID(),
});
mountCheckout(/** @type {HTMLElement} */ (document.querySelector('#checkout')), { orderService });
```
**Why it's right:** every I/O dependency is an explicit parameter, and tests pass fakes (`fetchFn: vi.fn()`, `now: () => new Date('2025-01-01T00:00:00Z')`) without `vi.mock()`; `buildOrder` is pure and deterministic; the service knows nothing about UI or storage and propagates errors to the caller; concrete wiring happens only in the composition root.

### 3. Event bus between features
```javascript
// src/shared/event-bus.js
// @ts-check

/**
 * Centralized contract: event name -> payload.
 * @typedef {{
 *   'search:changed': { query: string },
 *   'cart:item-added': { productId: string, qty: number },
 *   'session:ended': { reason: 'expired' | 'logout' },
 * }} AppEventMap
 */

export class TypedEventBus {
  #target = new EventTarget(); // private: no collisions with DOM events or external scripts

  /**
   * @template {keyof AppEventMap} K
   * @param {K} type
   * @param {AppEventMap[K]} detail
   */
  emit(type, detail) {
    this.#target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * @template {keyof AppEventMap} K
   * @param {K} type
   * @param {(detail: AppEventMap[K]) => void} listener
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {() => void} unsubscribe function
   */
  on(type, listener, { signal } = {}) {
    /** @param {Event} event */
    const handler = (event) => listener(/** @type {CustomEvent<AppEventMap[K]>} */ (event).detail);
    this.#target.addEventListener(type, handler, { signal });
    return () => this.#target.removeEventListener(type, handler);
  }
}

// --- src/main.js: the bus is created in the composition root and injected into the views ---
import { TypedEventBus } from './shared/event-bus.js';

const bus = new TypedEventBus();
const app = new AbortController();
bus.on('search:changed', ({ query }) => console.info('Search:', query), { signal: app.signal });
bus.emit('search:changed', { query: 'trail running shoes' });
// bus.emit('searchChanged', { q: 'x' }) -> error reported by @ts-check in the editor and in CI
```
**Why it's right:** names and payloads are statically verified by `// @ts-check` thanks to `@template` and `AppEventMap`; the private `EventTarget` isolates the bus from the DOM; every subscription can be removed either with the unsubscribe function or with an `AbortSignal`; the bus is an injected instance, not a global singleton.
