# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Automated check with rules disabled globally (Playwright)
```typescript
test('a11y', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast', 'label', 'button-name'])   // "too many failures"
    .analyze();
  expect(results.violations.length).toBeLessThan(10);
});
```
**Why it's wrong:**
- The most impactful rules (missing labels and button names) are disabled for the whole page.
- Allowing "fewer than 10" violations lets new ones slip in unnoticed; only the default page state is checked.

### 2. Keyboard behavior never tested
```text
Checkout dialog "Edit address":
- opens on click, focus stays on the page behind the overlay
- Tab moves through the page behind the dialog
- Escape does nothing; the only way to close is clicking the "×" icon (a <div>)
Automated axe scan: 0 violations → "accessible"
```
**Why it's wrong:**
- axe cannot detect most focus management and keyboard problems; a clean automated report gives false confidence.

## Best Practice (How to do it right)

### 1. Automated check with rules disabled globally (Playwright)
```typescript
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const state of ['empty', 'with-errors', 'address-dialog-open'] as const) {
  test(`checkout has no WCAG 2.2 AA violations (${state})`, async ({ page }) => {
    await openCheckoutInState(page, state);
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude('#third-party-chat')              // vendor widget, reported upstream: A11Y-142
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
```
**Why it's right:**
- All WCAG 2.2 AA rules run, on several UI states, with zero tolerance for violations.
- The only exclusion is narrow, justified, and tracked.

### 2. Keyboard behavior never tested
```typescript
test('address dialog is fully keyboard operable', async ({ page }) => {
  await page.goto('/checkout');
  const trigger = page.getByRole('button', { name: 'Edit address' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Edit address' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Street')).toBeFocused();       // focus moved into the dialog

  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);          // focus stays trapped inside

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();                            // focus returns to the trigger
});
```
```markdown
Manual check (release 4.2) — NVDA 2024.x + Firefox, VoiceOver + Safari iOS
- [x] Dialog announced as "Edit address, dialog"
- [x] Validation error "Postal code is required" announced when focus reaches the field
- [x] Order total update announced via live region
```
**Why it's right:**
- The scripted test covers focus entry, focus trap, Escape, and focus return, which automated rules cannot verify.
- A short manual screen reader checklist covers announcements for the critical journey.
