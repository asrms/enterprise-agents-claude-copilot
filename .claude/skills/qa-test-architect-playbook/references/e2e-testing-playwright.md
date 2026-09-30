# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Brittle selectors, fixed waits, and non-retrying assertions
```typescript
test('buy', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'mario@example.com');
  await page.fill('#pwd', 'Password123!');                // real credential in code
  await page.click('.btn.btn-primary');
  await page.waitForTimeout(3000);
  await page.click('div.grid > div:nth-child(2) .card button');
  await page.waitForTimeout(2000);
  expect(await page.locator('.toast').isVisible()).toBe(true);
  expect(await page.textContent('.cart-count')).toBe('1');
});
```
**Why it's wrong:**
- Layout-based selectors break with any design change and say nothing about what the user interacts with.
- Fixed waits are too long on fast machines and too short on slow CI agents.
- `isVisible()` and `textContent()` are evaluated once, so timing decides the result; credentials are hardcoded.

### 2. Tests that depend on each other and on shared data
```typescript
test.describe.serial('orders', () => {
  test('create order', async ({ page }) => { /* creates "Order 1" through the UI */ });
  test('edit order', async ({ page }) => { /* expects "Order 1" to exist */ });
  test('delete order', async ({ page }) => { /* deletes "Order 1" */ });
});
```
**Why it's wrong:**
- If the first test fails, the next ones fail for unrelated reasons; tests cannot run in parallel or alone.
- Fixed names collide when two CI runs share the same environment.

## Best Practice (How to do it right)

### 1. Brittle selectors, fixed waits, and non-retrying assertions
```typescript
// playwright.config.ts (excerpt)
export default defineConfig({
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/customer.json' }, dependencies: ['setup'] },
  ],
});

// e2e/auth.setup.ts
setup('authenticate customer', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_CUSTOMER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_CUSTOMER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'My account' })).toBeVisible();
  await page.context().storageState({ path: 'playwright/.auth/customer.json' });
});

// e2e/cart.spec.ts
test('customer adds a product to the cart', async ({ page }) => {
  await page.goto('/products/laptop-pro');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status')).toHaveText(/added to cart/i);
  await expect(page.getByRole('link', { name: /cart/i })).toHaveAccessibleName(/1 item/);
});
```
**Why it's right:**
- Login runs once in a setup project; tests start already authenticated through `storageState`.
- Role and label locators follow what the user sees; web-first assertions wait for the expected state.
- Credentials come from the environment and the base URL from configuration.

### 2. Tests that depend on each other and on shared data
```typescript
type Fixtures = { order: { id: string; name: string } };

export const test = base.extend<Fixtures>({
  order: async ({ request }, use, testInfo) => {
    const name = `Order ${testInfo.testId}`;                        // unique per test
    const res = await request.post('/api/test-data/orders', { data: { name } });
    expect(res.ok()).toBeTruthy();
    const order = await res.json();
    await use(order);
    await request.delete(`/api/test-data/orders/${order.id}`);      // cleanup
  },
});

test('customer renames an order', async ({ page, order }) => {
  await page.goto(`/orders/${order.id}`);
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Order name').fill(`${order.name} (renamed)`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${order.name} (renamed)`);
});
```
**Why it's right:**
- Each test creates and cleans its own data through the API, so tests are independent and parallel-safe.
- The fixture keeps setup out of the test body, which reads as a user journey.
