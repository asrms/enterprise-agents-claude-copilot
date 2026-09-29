# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Form test based on implementation details and `fireEvent`
```tsx
// features/newsletter/components/newsletter-form.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsletterForm } from './newsletter-form';

global.fetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ subscribed: true }), { status: 201 })),
);

describe('NewsletterForm', () => {
  it('works', async () => {
    const { container } = render(<NewsletterForm />);
    const input = container.querySelector('input.nl-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mario.rossi@example.com' } });
    fireEvent.click(container.querySelector('.btn-primary')!);

    await new Promise((resolve) => setTimeout(resolve, 500)); // arbitrary wait
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.success-msg')).not.toBeNull();
    expect(container).toMatchSnapshot();
  });
});
```
**Why it's wrong:** CSS selectors tie the test to the markup and do not verify that controls have an accessible name; `fireEvent` skips focus and the keyboard sequence; the `setTimeout` makes the test slow and flaky; the manual `fetch` mock stays global for other tests and the snapshot of the whole tree gets updated without review; the error case is missing.

### 2. Server Action tested through the async page
```tsx
// app/(dashboard)/invoices/[id]/page.test.tsx
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import InvoicePage from './page';

vi.mock('@/features/invoices/server/queries', () => ({
  getInvoice: vi.fn().mockResolvedValue({ id: 'inv_1', status: 'draft', totalCents: 12000 }),
}));

it('approves the invoice', async () => {
  // async Server Component invoked as a function: not supported by RTL
  render(await InvoicePage({ params: Promise.resolve({ id: 'inv_1' }) }));
  screen.getByText('Approve').click();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // the real Server Action is never executed: no check on auth and input
  expect(screen.getByText('approved')).toBeTruthy();
});
```
**Why it's wrong:** rendering async Server Components in jsdom is not supported and breaks with Suspense, `headers()`, and `cookies()`; the Server Action is not tested, so authentication, validation, and authorization remain uncovered; the native `click()` and the fixed wait make the test non-deterministic.

### 3. E2E with arbitrary waits, CSS selectors, and no a11y checks
```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test('checkout', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'e2e.customer@example.com');
  await page.fill('#password', process.env.E2E_PASSWORD ?? '');
  await page.click('.btn.btn-primary');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/products/laptop-pro');
  await page.click('div.product-actions > button:nth-child(2)');
  await page.waitForTimeout(2000);
  await page.click('text=Cart');

  const total = await page.textContent('.cart-total');
  expect(total).toBe('€1,299.00');

  await page.click('#checkout-btn');
  await page.waitForTimeout(5000);
  expect(await page.isVisible('.success')).toBe(true);
});
```
**Why it's wrong:** `waitForTimeout` lengthens the suite and fails anyway on slow CI; CSS selectors and `nth-child` break with every markup refactoring; login via the UI repeated in every test and hardcoded URLs instead of `baseURL`; `expect(await ...)` has no auto-retry and no page is checked with axe.

## Best Practice (How to do it right)

### 1. Form test based on implementation details and `fireEvent`
```tsx
// test/msw/server.ts
import { setupServer } from 'msw/node';

export const server = setupServer();

// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './test/msw/server';

beforeAll(() => { server.listen({ onUnhandledRequest: 'error' }); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });

// features/newsletter/components/newsletter-form.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { NewsletterForm } from './newsletter-form';

async function submitEmail(email: string): Promise<void> {
  const user = userEvent.setup();
  render(<NewsletterForm />);
  await user.type(screen.getByRole('textbox', { name: /email/i }), email);
  await user.click(screen.getByRole('button', { name: /subscribe/i }));
}

describe('NewsletterForm', () => {
  it('confirms the subscription after submitting a valid email', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({ subscribed: true }, { status: 201 })));
    await submitEmail('mario.rossi@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(/subscription confirmed/i);
  });

  it('shows an accessible error if the email is already subscribed', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({ code: 'ALREADY_SUBSCRIBED' }, { status: 409 })));
    await submitEmail('mario.rossi@example.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(/already subscribed/i);
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveAttribute('aria-invalid', 'true');
  });
});
```
**Why it's right:** queries by role and name also verify the form's accessibility; `userEvent` reproduces real interaction; MSW intercepts the network at the request level with `onUnhandledRequest: 'error'` and per-test overrides; `findByRole` waits deterministically and both success and error are covered.

### 2. Server Action tested through the async page
```ts
// features/invoices/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { invoiceRepository } from '@/features/invoices/server/invoice-repository';
import { updateInvoiceStatus } from './actions';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/features/invoices/server/invoice-repository', () => ({
  invoiceRepository: { findById: vi.fn(), updateStatus: vi.fn() },
}));

const INVOICE_ID = '3f1c9c3e-8a7b-4f0e-9d2a-6b5c4e3d2a10';
const formOf = (values: Record<string, string>): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
};

describe('updateInvoiceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-a', permissions: ['invoice:approve'] });
    vi.mocked(invoiceRepository.findById).mockResolvedValue({ id: INVOICE_ID, tenantId: 'tenant-a' });
  });

  it('rejects the request without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const result = await updateInvoiceStatus({ status: 'idle' }, formOf({ invoiceId: INVOICE_ID, status: 'approved' }));
    expect(result).toEqual({ status: 'error', code: 'UNAUTHENTICATED' });
    expect(invoiceRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects a status that is not allowed', async () => {
    const result = await updateInvoiceStatus({ status: 'idle' }, formOf({ invoiceId: INVOICE_ID, status: 'paid' }));
    expect(result).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
  });

  it('does not reveal invoices of another tenant', async () => {
    vi.mocked(invoiceRepository.findById).mockResolvedValue({ id: INVOICE_ID, tenantId: 'tenant-b' });
    const result = await updateInvoiceStatus({ status: 'idle' }, formOf({ invoiceId: INVOICE_ID, status: 'approved' }));
    expect(result).toEqual({ status: 'error', code: 'NOT_FOUND' });
  });

  it("approves the invoice and invalidates the tenant's cache", async () => {
    const result = await updateInvoiceStatus({ status: 'idle' }, formOf({ invoiceId: INVOICE_ID, status: 'approved' }));
    expect(result).toEqual({ status: 'success' });
    expect(invoiceRepository.updateStatus).toHaveBeenCalledWith(INVOICE_ID, 'approved', 'user-1');
    expect(revalidateTag).toHaveBeenCalledWith('invoices:tenant-a');
  });
});
```
**Why it's right:** the Server Action is tested as an async function with a real `FormData`, quickly and deterministically; the security branches (missing session, invalid input, different tenant) are covered in addition to the happy path; `server-only`, `next/cache`, and external dependencies are mocked explicitly and the invalidation of the correct tag is verified. The async page remains covered by e2e tests.

### 3. E2E with arbitrary waits, CSS selectors, and no a11y checks
```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// session created only once by the setup project (playwright.config.ts) and reused
test.use({ storageState: 'e2e/.auth/customer.json' });

test.describe('checkout', () => {
  test('completes an order with the saved card', async ({ page }) => {
    await page.goto('/products/laptop-pro'); // baseURL from playwright.config.ts
    await expect(page.getByRole('heading', { level: 1, name: 'Laptop Pro' })).toBeVisible();

    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('status')).toHaveText(/added to cart/i);

    await page.getByRole('link', { name: /cart/i }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('region', { name: 'Order summary' })).toContainText(/€1,299\.00/);

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  });

  test('the cart page has no WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```
**Why it's right:** locators by role and name are stable and verify accessibility; web-first assertions (`toBeVisible`, `toHaveURL`, `toContainText`) wait for the expected state without arbitrary timeouts; `storageState` and `baseURL` avoid repeated logins and hardcoded URLs; axe with the WCAG 2.2 AA tags blocks accessibility regressions.
