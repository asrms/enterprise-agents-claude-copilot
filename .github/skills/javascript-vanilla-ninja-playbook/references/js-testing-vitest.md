# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Testing search with debounce
```javascript
// src/features/search/product-search.test.js
import { it, expect } from 'vitest';
import { mountProductSearch } from './product-search.js';

it('works', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  let calls = 0;
  const search = mountProductSearch(document.querySelector('#app'), {
    searchProducts: async () => { calls++; return [{ id: 'p1', name: 'Running shoes' }]; },
  });

  const input = document.querySelector('#app input.search-box__input');   // styling CSS selector
  input.value = 'shoes';
  input.dispatchEvent(new Event('input'));                                  // partial synthetic event
  await new Promise((resolve) => setTimeout(resolve, 400));                 // real wait: slow and flaky in CI

  expect(calls).toBe(1);
  expect(search._debounceTimer).toBeNull();                                 // private detail
  expect(document.querySelector('.search-box__results').children.length).toBe(1);
});
// no afterEach: DOM, listeners, and timers stay active for the next test
```
**Why it's wrong:** the real 400 ms wait slows down the suite and fails intermittently on slow CI; CSS selectors and the `_debounceTimer` field tie the test to the implementation, so a harmless refactoring breaks it; `dispatchEvent` does not simulate real typing; the name `works` documents nothing and the leftover DOM contaminates other tests.

### 2. Mocking fetch in an API service
```javascript
// src/features/orders/order-api.test.js
import { it, expect, vi } from 'vitest';
import { createOrderApi } from './order-api.js';

global.fetch = vi.fn(() =>                                       // overwritten for the whole file, never restored
  Promise.resolve({ json: () => Promise.resolve([{ id: 'o-1' }]) }), // not a Response: no ok, status, headers
);

it('list', async () => {
  const api = createOrderApi({ baseUrl: 'https://api.acme.test' });
  const orders = await api.list({ page: 1 });
  expect(orders).toEqual([{ id: 'o-1' }]);
});

it('handles errors', async () => {
  fetch.mockImplementationOnce(() => Promise.reject('boom'));    // rejection with a string, not an Error
  const api = createOrderApi({ baseUrl: 'https://api.acme.test' });
  try {
    await api.list({ page: 1 });
  } catch (e) {
    expect(e).toBeDefined();                                     // if it does not throw, the test passes anyway
  }
});
```
**Why it's wrong:** the fake object has no `ok`, `status`, and `headers`, so code that checks them behaves differently from production; the global mock is never restored and leaks into other tests; the `try/catch` without `expect.assertions()` passes the test even if the error is not thrown; neither the error type nor the `cause` is verified.

### 3. Suite configuration and testing a DOM component
```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: { enabled: true },   // no threshold: coverage can collapse without CI failing
    // no environment: "document is not defined", or every file sets it its own way
    // no setupFiles or restoreMocks: mocks and DOM survive between tests
  },
});

// src/features/cart/cart-view.test.js
import { mountCart } from './cart-view.js';

test('cart', async () => {
  document.body.innerHTML = '<section id="cart"></section>';
  mountCart(document.querySelector('#cart'), { baseUrl: 'https://api.acme.it' }); // real network call
  await new Promise((r) => setTimeout(r, 1000));
  expect(document.querySelector('.cart-table tr:nth-child(1) td.cart-table__name').textContent).toBe('Backpack');
  expect(document.body.innerHTML).toMatchSnapshot();                             // snapshot of the entire DOM
});
```
**Why it's wrong:** without an environment and shared setup, DOM tests fail or depend on local configurations; coverage without `thresholds` does not protect against regressions; the test contacts a real API, so it is slow, non-deterministic, and dependent on an environment's data; the structural selector and the whole-body snapshot break with every markup change without verifying any behavior.

## Best Practice (How to do it right)

### 1. Testing search with debounce
```javascript
// src/features/search/product-search.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getByRole, getAllByRole, queryAllByRole } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { mountProductSearch } from './product-search.js';

describe('mountProductSearch', () => {
  /** @type {AbortController} */
  let controller;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new AbortController();
  });

  afterEach(() => {
    controller.abort();                   // removes the listeners registered by the component
    document.body.replaceChildren();      // @testing-library/dom does not clean up automatically
    vi.useRealTimers();
  });

  it('searches only once with the final text after a 300 ms pause', async () => {
    // Arrange
    const searchProducts = vi.fn().mockResolvedValue([{ id: 'p1', name: 'Running shoes' }]);
    mountProductSearch(document.body, { searchProducts, signal: controller.signal });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Act
    await user.type(getByRole(document.body, 'searchbox', { name: 'Search products' }), 'shoes');
    await vi.advanceTimersByTimeAsync(300);

    // Assert
    expect(searchProducts).toHaveBeenCalledOnce();
    expect(searchProducts).toHaveBeenCalledWith('shoes', expect.any(AbortSignal));
    const items = getAllByRole(document.body, 'listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Running shoes']);
  });

  it('does not search when the text has fewer than 2 characters', async () => {
    // Arrange
    const searchProducts = vi.fn();
    mountProductSearch(document.body, { searchProducts, signal: controller.signal });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Act
    await user.type(getByRole(document.body, 'searchbox', { name: 'Search products' }), 's');
    await vi.advanceTimersByTimeAsync(1000);

    // Assert
    expect(searchProducts).not.toHaveBeenCalled();
    expect(queryAllByRole(document.body, 'listitem')).toHaveLength(0);
  });
});
```
**Why it's right:** fake timers make the test instant and deterministic, and `advanceTimersByTimeAsync` also resolves the search promises; queries by role and accessible name verify what the user sees and stay valid after a markup refactoring; user-event simulates real typing and is synchronized with the fake timers; `afterEach` cleans up DOM, listeners, and timers, and with Vitest fake timers synchronous queries are used instead of `findBy*`.

### 2. Mocking fetch in an API service
```javascript
// src/features/orders/order-api.test.js
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOrderApi } from './order-api.js';
import { HttpError } from '../../shared/http/fetch-json.js';

/**
 * A real Response: the code under test reads ok, status, and headers as in production.
 * @param {unknown} body
 * @param {number} [status]
 */
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createOrderApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();                // restores the original fetch after every test
  });

  it('returns the orders of the requested page', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([{ id: 'o-1', totalCents: 4990 }]));
    const api = createOrderApi({ baseUrl: 'https://api.acme.test', retries: 0 });

    // Act
    const orders = await api.list({ page: 2 });

    // Assert
    expect(orders).toEqual([{ id: 'o-1', totalCents: 4990 }]);
    const requestedUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get('page')).toBe('2');
  });

  it('rejects with an error that keeps HttpError as its cause on 404', async () => {
    // Arrange
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'not found' }, 404));
    const api = createOrderApi({ baseUrl: 'https://api.acme.test', retries: 0 });

    // Act
    const result = api.list({ page: 1 });

    // Assert
    await expect(result).rejects.toThrow('Loading orders failed');
    await expect(result).rejects.toHaveProperty('cause', expect.any(HttpError));
  });
});
```
**Why it's right:** `vi.spyOn(globalThis, 'fetch')` with real `Response` objects (available in Node 18+) faithfully reproduces `ok`, `status`, and body parsing; `vi.restoreAllMocks()` isolates every test; `rejects.toThrow` and `rejects.toHaveProperty('cause', expect.any(HttpError))` fail if the error is not thrown or loses its cause; the pure network-logic test runs in the `node` environment, faster than the simulated DOM.

### 3. Suite configuration and testing a DOM component
```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',             // logic-only files declare // @vitest-environment node
    setupFiles: ['./test/setup.js'],
    include: ['src/**/*.test.js'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/main.js'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});

// --- test/msw-server.js ---
import { setupServer } from 'msw/node';
export const server = setupServer(); // handlers defined in individual tests with server.use()

// --- test/setup.js ---
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // no real network calls
afterEach(() => {
  server.resetHandlers();
  document.body.replaceChildren();
});
afterAll(() => server.close());

// --- src/features/cart/cart-view.test.js ---
import { describe, it, expect } from 'vitest';
import { findByRole, getByRole } from '@testing-library/dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server.js';
import { mountCart } from './cart-view.js';

describe('mountCart', () => {
  it('shows the items returned by the API with an accessible remove button', async () => {
    server.use(http.get('https://api.acme.test/cart', () =>
      HttpResponse.json({ items: [{ id: 'a', name: 'Backpack', qty: 2, priceCents: 5900 }] })));
    const root = document.body.appendChild(document.createElement('section'));

    mountCart(root, { baseUrl: 'https://api.acme.test' });

    expect(await findByRole(root, 'row', { name: /Backpack/ })).toBeInTheDocument();
    expect(getByRole(root, 'button', { name: 'Remove Backpack' })).toBeEnabled();
  });
});
```
**Why it's right:** environment, setup, and mock restoration are centralized and the same for every file; the thresholds in `coverage.thresholds` fail CI on regression; MSW intercepts the network with `onUnhandledRequest: 'error'`, so no test can contact real services; the test verifies rows and buttons by role and accessible name, and without fake timers `findByRole` reliably waits for the async render.
