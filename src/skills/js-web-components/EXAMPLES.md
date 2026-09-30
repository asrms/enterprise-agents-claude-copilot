# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Star rating component
```javascript
// src/components/rating.js
class Rating extends HTMLElement {
  constructor() {
    super();
    const value = this.getAttribute('value');            // attributes not yet available with createElement()
    this.innerHTML = '<span class="sr-only">Rating</span>'; // children in the constructor: forbidden by the spec
    this.attachShadow({ mode: 'open' });
    this.render(value);
  }

  static get observedAttributes() { return ['value', 'label']; }

  attributeChangedCallback() {
    this.render(this.getAttribute('value'));             // full re-render on every attribute change
  }

  render(value) {
    // style duplicated and re-parsed for every instance, markup built by interpolation
    this.shadowRoot.innerHTML = `
      <style>button { font-size: 24px; background: none; border: 0 }</style>
      ${[1, 2, 3, 4, 5].map((n) => `<button>${n <= value ? '★' : '☆'}</button>`).join('')}
      <span>${this.getAttribute('label')}</span>`;
  }
}

customElements.define('rating', Rating);                  // SyntaxError: name without a hyphen
```
**Why it's wrong:** the name without a hyphen is invalid and registration fails; the constructor adds children to the host, which throws `NotSupportedError` with `document.createElement()`; every attribute change recreates the entire shadow root, losing focus and state, and every instance re-parses the same CSS; the `label` attribute interpolated into `innerHTML` opens the door to XSS.

### 2. Dropdown with global listeners and events
```javascript
// src/components/acme-dropdown.js
class AcmeDropdown extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });                 // on the second connection: NotSupportedError
    this.shadowRoot.innerHTML = '<button part="trigger">Menu</button><ul hidden><slot></slot></ul>';
    // global listeners never removed: they stay active and retain the component after removal
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) this.close();
    });
    window.addEventListener('resize', () => this.reposition());
    this.shadowRoot.querySelector('button').onclick = () => this.toggle();
  }

  toggle() {
    const list = this.shadowRoot.querySelector('ul');
    list.hidden = !list.hidden;
    // dispatched on the shadow root without bubbles/composed: the consumer never receives it
    this.shadowRoot.dispatchEvent(new Event('toggle'));
  }

  close() { this.shadowRoot.querySelector('ul').hidden = true; }

  reposition() { this.style.top = `${this.getBoundingClientRect().bottom}px`; }
}

customElements.define('acme-dropdown', AcmeDropdown);
```
**Why it's wrong:** `attachShadow()` in `connectedCallback` throws when the element is moved within the DOM; the listeners on `document` and `window` are never removed and cause memory leaks and calls on detached components; the event does not leave the shadow root and the name `toggle` collides with a native event; `aria-expanded`, Escape handling, and `type="button"` are missing.

### 3. Quantity field in a form
```javascript
// src/components/acme-quantity.js
class AcmeQuantity extends HTMLElement {
  connectedCallback() {
    const value = this.getAttribute('value') || 1;
    this.innerHTML = `
      <button class="dec">-</button>
      <span class="val">${value}</span>
      <button class="inc">+</button>
      <input type="hidden" name="${this.getAttribute('name')}" value="${value}">`;
    this.querySelector('.inc').addEventListener('click', () => this.step(1));
    this.querySelector('.dec').addEventListener('click', () => this.step(-1));
  }

  step(delta) {
    const input = this.querySelector('input');
    const next = Number(input.value) + delta;            // no min/max limit or validity
    input.value = next;
    this.querySelector('.val').textContent = next;
  }
}

customElements.define('acme-quantity', AcmeQuantity);
// <form><acme-quantity name="qty" value="1" required></acme-quantity></form>
```
**Why it's wrong:** the `<button>`s without `type="button"` in the form's light DOM trigger a submit on every click; the helper hidden input does not support `required`, `:invalid`, `form.reset()`, or `disabled` on the fieldset; on every reconnection the content and listeners are recreated, resetting the value; attributes interpolated into `innerHTML` allow injection and accessible labels are missing.

## Best Practice (How to do it right)

### 1. Star rating component
```javascript
// src/components/acme-rating/acme-rating.js
// @ts-check
const MAX_STARS = 5;
const sheet = new CSSStyleSheet(); // shared by all instances: parsed only once
sheet.replaceSync(`
  :host { display: inline-flex; gap: 2px; }
  :host([disabled]) { opacity: .5; pointer-events: none; }
  button { font-size: var(--acme-rating-size, 24px); background: none; border: 0; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--acme-accent, #0a66c2); }
`);

export class AcmeRating extends HTMLElement {
  static observedAttributes = ['value'];
  /** @type {HTMLButtonElement[]} */
  #stars = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); // internal structure only, no host attributes or children
    root.adoptedStyleSheets = [sheet];
    for (let n = 1; n <= MAX_STARS; n++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.dataset.value = String(n);
      star.setAttribute('aria-label', `${n} of ${MAX_STARS}`);
      this.#stars.push(star);
    }
    root.append(...this.#stars);
  }

  connectedCallback() { this.#syncStars(); }

  get value() { return Number(this.getAttribute('value')) || 0; }
  set value(next) {
    const clamped = Math.min(Math.max(Math.round(Number(next)) || 0, 0), MAX_STARS);
    this.setAttribute('value', String(clamped)); // property -> attribute reflection
  }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(next) { this.toggleAttribute('disabled', Boolean(next)); }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && name === 'value') this.#syncStars(); // targeted update
  }

  #syncStars() {
    for (const star of this.#stars) {
      const active = Number(star.dataset.value) <= this.value;
      star.textContent = active ? '★' : '☆';
      star.setAttribute('aria-pressed', String(active));
    }
  }
}

if (!customElements.get('acme-rating')) customElements.define('acme-rating', AcmeRating);
```
**Why it's right:** the name has a hyphen and a prefix and registration is idempotent; the constructor builds only the shadow root and the style is a `CSSStyleSheet` shared via `adoptedStyleSheets`; `value` and `disabled` reflect to attributes and `attributeChangedCallback` updates only the stars' text and `aria-pressed`; no data goes through `innerHTML`.

### 2. Dropdown with global listeners and events
```javascript
// src/components/acme-dropdown/acme-dropdown.js
// @ts-check
export class AcmeDropdown extends HTMLElement {
  /** @type {AbortController | null} */
  #connection = null;
  #trigger = document.createElement('button');
  #panel = document.createElement('div');

  constructor() {
    super();
    const label = document.createElement('slot');
    label.name = 'label';
    label.textContent = 'Menu';                             // slot fallback content
    this.#trigger.type = 'button';
    this.#trigger.part.add('trigger');
    this.#trigger.setAttribute('aria-expanded', 'false');
    this.#trigger.append(label);
    this.#panel.part.add('panel');
    this.#panel.hidden = true;
    this.#panel.append(document.createElement('slot'));     // default slot for the items
    this.attachShadow({ mode: 'open' }).append(this.#trigger, this.#panel);
  }

  connectedCallback() {
    this.#connection?.abort();                              // idempotent if the element is moved
    this.#connection = new AbortController();
    const { signal } = this.#connection;
    this.#trigger.addEventListener('click', () => this.toggle(), { signal });
    document.addEventListener('pointerdown', (event) => {
      if (!event.composedPath().includes(this)) this.close(); // outside click, even through the shadow DOM
    }, { signal });
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.open) return;
      this.close();
      this.#trigger.focus();
    }, { signal });
  }

  disconnectedCallback() {
    this.#connection?.abort();                              // removes all listeners in one go
    this.#connection = null;
  }

  get open() { return !this.#panel.hidden; }

  toggle(force = !this.open) {
    if (force === this.open) return;
    this.#panel.hidden = !force;
    this.#trigger.setAttribute('aria-expanded', String(force));
    this.dispatchEvent(new CustomEvent('acme-dropdown-toggle', {
      detail: { open: force }, bubbles: true, composed: true,
    }));
  }

  close() { this.toggle(false); }
}

if (!customElements.get('acme-dropdown')) customElements.define('acme-dropdown', AcmeDropdown);
```
**Why it's right:** the shadow root is created only once in the constructor; every `connectedCallback` listener is tied to an `AbortController` that `disconnectedCallback` aborts, so there are no leaks even after repeated moves; `composedPath()` recognizes internal clicks even through the shadow DOM; the prefixed event with `bubbles` and `composed` reaches the consumer, and `aria-expanded` plus Escape make the component accessible.

### 3. Quantity field in a form
```javascript
// src/components/acme-quantity/acme-quantity.js
// @ts-check
export class AcmeQuantity extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  #output = document.createElement('output');
  #value = 0;
  #initialized = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    root.append(this.#button('−', 'Decrease quantity', -1), this.#output, this.#button('+', 'Increase quantity', 1));
    this.#internals.role = 'group'; // ARIA semantics without adding attributes to the host
  }

  get min() { return Number(this.getAttribute('min') ?? 1); }
  get max() { return Number(this.getAttribute('max') ?? 99); }
  get value() { return this.#value; }
  set value(next) {
    this.#value = Math.trunc(Number(next)) || 0;
    this.#output.textContent = String(this.#value);
    this.#internals.setFormValue(String(this.#value)); // included in FormData and in the submit
    const flags = { rangeUnderflow: this.#value < this.min, rangeOverflow: this.#value > this.max };
    const message = flags.rangeUnderflow ? `Minimum ${this.min}` : flags.rangeOverflow ? `Maximum ${this.max}` : '';
    this.#internals.setValidity(flags, message, this.#output); // enables :invalid and reportValidity()
  }

  connectedCallback() {
    if (this.#initialized) return; // no reset when the element is moved within the DOM
    this.#initialized = true;
    this.formResetCallback();
  }

  // form.reset() restores the field to the default value declared in the attribute
  formResetCallback() { this.value = Number(this.getAttribute('value') ?? this.min); }

  formDisabledCallback(/** @type {boolean} */ disabled) {
    for (const button of this.shadowRoot?.querySelectorAll('button') ?? []) button.disabled = disabled;
  }

  /**
   * @param {string} text
   * @param {string} label
   * @param {number} delta
   */
  #button(text, label, delta) {
    const button = document.createElement('button');
    button.type = 'button'; // never an implicit form submit
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      this.value = Math.min(Math.max(this.#value + delta, this.min), this.max);
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return button;
  }
}

if (!customElements.get('acme-quantity')) customElements.define('acme-quantity', AcmeQuantity);
```
**Why it's right:** with `formAssociated` and `ElementInternals` (Chrome 77+, Firefox 98+, Safari 16.4+) the component participates in `FormData`, `form.reset()`, `disabled` inherited from the fieldset, and native validation with `setValidity()`; internal buttons are `type="button"` with accessible labels; initialization does not repeat on every reconnection; listeners on internal shadow root nodes need no cleanup because they are collected together with the component.
