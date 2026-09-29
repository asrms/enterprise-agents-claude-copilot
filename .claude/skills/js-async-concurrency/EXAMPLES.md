# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Typeahead search with out-of-order responses
```javascript
// src/search/typeahead.js
const input = document.querySelector('#search');
const results = document.querySelector('#results');

input.addEventListener('input', async () => {
  // no debounce and no cancellation: "sh", "sho", "shoe" all fire in parallel
  const res = await fetch('/api/products?q=' + input.value);   // no encoding, no timeout
  const data = await res.json();                               // 500 with an HTML body: unhandled SyntaxError
  // the slowest response (maybe the one for "sh") overwrites the one for "shoes"
  results.innerHTML = data.items.map((i) => `<li>${i.name}</li>`).join('');
});

document.querySelector('#refresh').addEventListener('click', () => {
  loadRecommendations();                                        // floating promise
});

async function loadRecommendations() {
  const res = await fetch('/api/recommendations');              // can hang for minutes
  if (res.status !== 200) throw 'recommendations error';        // string: no stack, no cause
  return res.json();
}
```
**Why it's wrong:** responses arrive in arbitrary order and a stale request can overwrite the current result; no request has a timeout or can be cancelled; `input.value` is not encoded in the URL; the `loadRecommendations()` promise is not handled and the error ends up in `unhandledrejection` as a string with no stack.

### 2. Retrying HTTP calls
```javascript
// src/api/http.js
export async function requestJson(url, options = {}, retries = 5) {
  try {
    const res = await fetch(url, options);
    return await res.json();                         // 404 or 500 treated as success if the body is JSON
  } catch (e) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000)); // fixed interval: every client retries at the same time
      return requestJson(url, options, retries - 1); // also retries permanent errors
    }
    console.log(e);
    throw new Error('Request failed');               // original cause lost
  }
}

export function saveOrder(order) {
  // non-idempotent POST retried up to 5 times: risk of duplicate orders
  return requestJson('/api/orders', { method: 'POST', body: JSON.stringify(order) });
}
```
**Why it's wrong:** `response.ok` is not checked, so 4xx/5xx responses are not recognized; the fixed interval without jitter synchronizes retries across all clients (thundering herd) and ignores `Retry-After`; permanent errors and non-idempotent POSTs are retried too; the final error loses its `cause` and there is no timeout or cancellation.

### 3. Dashboard and bulk uploads
```javascript
// src/dashboard/load-dashboard.js
export async function loadDashboard() {
  // a single failing widget makes the whole dashboard fail
  const [sales, stock, tickets] = await Promise.all([
    fetch('/api/widgets/sales').then((r) => r.json()),
    fetch('/api/widgets/stock').then((r) => r.json()),
    fetch('/api/widgets/tickets').then((r) => r.json()),
  ]);
  return { sales, stock, tickets };
}

// src/uploads/bulk-upload.js
export async function uploadAll(files) {
  // 800 files = 800 simultaneous requests: saturated connections, memory, and cascading timeouts
  await Promise.all(files.map((file) => fetch('/api/upload', { method: 'POST', body: file })));
}

export async function uploadSequential(files) {
  files.forEach(async (file) => {
    await fetch('/api/upload', { method: 'POST', body: file }); // forEach does not wait
  });
  console.log('Uploads completed');                             // printed before the first one finishes
}
```
**Why it's wrong:** `Promise.all` is fail-fast and hides the data of the widgets that succeeded; firing hundreds of uploads at once saturates per-origin connections and memory; `forEach` with an async callback awaits nothing and errors become unhandled rejections; no operation can be cancelled.

## Best Practice (How to do it right)

### 1. Typeahead search with out-of-order responses
```javascript
// src/features/search/typeahead.js
// @ts-check
import { debounce } from '../../shared/timing.js';

/**
 * @param {{
 *   input: HTMLInputElement,
 *   render: (items: { id: string, name: string }[]) => void,
 *   onError: (error: Error) => void,
 *   signal: AbortSignal,
 * }} deps
 */
export function setupTypeahead({ input, render, onError, signal }) {
  /** @type {AbortController | undefined} */
  let current;

  /** @param {string} query */
  async function search(query) {
    current?.abort();                                  // latest wins: cancel the previous request
    const controller = new AbortController();
    current = controller;
    const url = new URL('/api/products', location.origin);
    url.searchParams.set('q', query);                  // correct parameter encoding
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([controller.signal, signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { items } = await response.json();
      if (controller === current) render(items);       // second guard against stale responses
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // cancelled: not an error
      onError(new Error(`Search "${query}" failed`, { cause: error }));         // includes TimeoutError
    }
  }

  const debouncedSearch = debounce((/** @type {string} */ query) => void search(query), 250);
  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query.length >= 2) debouncedSearch(query);
  }, { signal });
}

// --- src/features/recommendations/refresh-button.js ---
/**
 * @param {HTMLButtonElement} button
 * @param {{ load: (signal: AbortSignal) => Promise<void>, showError: (error: unknown) => void, signal: AbortSignal }} deps
 */
export function bindRefresh(button, { load, showError, signal }) {
  button.addEventListener('click', () => {
    load(AbortSignal.any([signal, AbortSignal.timeout(8000)])).catch(showError); // promise always handled
  }, { signal });
}
```
**Why it's right:** every new search cancels the previous one and only the current response updates the UI; `AbortSignal.any()` (Chrome 116+, Firefox 124+, Safari 17.4+) combines user cancellation, view teardown, and timeout; `AbortError` is ignored while other errors are enriched with `cause`; no promise is left unhandled.

### 2. Retrying HTTP calls
```javascript
// src/shared/http/fetch-json.js
// @ts-check
export class HttpError extends Error {
  /** @param {Response} response */
  constructor(response) {
    super(`HTTP ${response.status} on ${response.url}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.retryAfter = response.headers.get('Retry-After');
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** @param {unknown} error */
function isTransient(error) {
  if (error instanceof HttpError) return RETRYABLE_STATUS.has(error.status);
  if (error instanceof DOMException) return error.name === 'TimeoutError';
  return error instanceof TypeError; // network error
}

/**
 * Interruptible wait: rejects immediately with signal.reason if the signal is aborted.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => { clearTimeout(timerId); reject(signal?.reason); };
    const timerId = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Only for idempotent requests (GET/PUT/DELETE or POST with Idempotency-Key).
 * @param {string | URL} url
 * @param {RequestInit & { retries?: number, baseDelayMs?: number, maxDelayMs?: number, timeoutMs?: number }} [options]
 */
export async function fetchJson(url, options = {}) {
  const { retries = 3, baseDelayMs = 300, maxDelayMs = 5000, timeoutMs = 8000, signal, ...init } = options;
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!response.ok) throw new HttpError(response);
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;                // caller cancellation: propagate AbortError
      if (attempt >= retries || !isTransient(error)) {
        throw new Error(`Request ${url} failed after ${attempt + 1} attempts`, { cause: error });
      }
      const retryAfterSec = error instanceof HttpError && error.retryAfter ? Number(error.retryAfter) : Number.NaN;
      const backoffMs = Math.random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt); // full jitter
      await sleep(Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : backoffMs, signal ?? undefined);
    }
  }
}
```
**Why it's right:** only transient errors are retried, distinguishing network, timeout, and HTTP status; exponential backoff with full jitter spreads retries over time and `Retry-After` takes precedence; each attempt has its own timeout and the wait is interruptible by the `signal`; the final error preserves the original in `cause`, while for POSTs the caller passes an `Idempotency-Key` header.

### 3. Dashboard and bulk uploads
```javascript
// src/shared/async/run-pool.js
// @ts-check
/**
 * Runs the tasks with at most `concurrency` operations in parallel.
 * @template T, R
 * @param {readonly T[]} items
 * @param {(item: T, index: number) => Promise<R>} task
 * @param {{ concurrency?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<PromiseSettledResult<R>[]>}
 */
export async function runPool(items, task, { concurrency = 4, signal } = {}) {
  /** @type {PromiseSettledResult<R>[]} */
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      signal?.throwIfAborted();                         // stops all workers on abort
      const index = nextIndex++;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// --- src/features/uploads/bulk-upload.js ---
import { runPool } from '../../shared/async/run-pool.js';

/**
 * @param {readonly File[]} files
 * @param {(file: File, signal: AbortSignal) => Promise<void>} upload
 * @param {AbortSignal} signal
 */
export async function uploadAll(files, upload, signal) {
  const results = await runPool(files, (file) => upload(file, signal), { concurrency: 4, signal });
  const failed = files.filter((_, i) => results[i].status === 'rejected');
  return { uploaded: files.length - failed.length, failed }; // the UI offers to retry only the failed ones
}

// --- src/features/dashboard/load-dashboard.js ---
const WIDGETS = /** @type {const} */ (['sales', 'stock', 'tickets']);

/**
 * @param {(path: string, signal: AbortSignal) => Promise<unknown>} getJson
 * @param {AbortSignal} signal
 */
export async function loadDashboard(getJson, signal) {
  const settled = await Promise.allSettled(WIDGETS.map((name) => getJson(`/api/widgets/${name}`, signal)));
  return Object.fromEntries(settled.map((result, i) => [   // each widget receives data or its own error
    WIDGETS[i],
    result.status === 'fulfilled' ? { data: result.value } : { error: result.reason },
  ]));
}
```
**Why it's right:** the pool keeps at most 4 uploads active and returns the outcome of every file in `PromiseSettledResult` format; `signal.throwIfAborted()` stops the workers when the user cancels; `Promise.allSettled` lets the dashboard show the widgets that succeeded and a localized error for the others; no async callback ends up in a `forEach`.
