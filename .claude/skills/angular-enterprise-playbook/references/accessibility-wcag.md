# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Inaccessible custom controls and form (HTML)
```html
<div class="btn" onclick="save()">Save</div>                 <!-- not focusable, no role -->
<img src="/icons/trash.svg" onclick="remove()">              <!-- no name, no keyboard -->
<input type="email" placeholder="Email">                     <!-- placeholder as the only label -->
<span style="color:#aaa">Invalid email</span>               <!-- low contrast, not announced -->
<style> *:focus { outline: none; } </style>                  <!-- invisible focus -->
```
**Why it's wrong:**
- Keyboard and screen reader users cannot reach or identify the actions.
- The field loses its label when typing starts, and the error is neither associated nor announced.
- Removing the focus outline makes keyboard navigation impossible to follow.

## Best Practice (How to do it right)

### 1. Native elements, labels, and announced errors (HTML)
```html
<form novalidate aria-describedby="form-hint">
  <p id="form-hint">Fields marked with * are required.</p>

  <label for="email">Email address *</label>
  <input id="email" name="email" type="email" autocomplete="email" required
         aria-invalid="true" aria-describedby="email-error">
  <p id="email-error" class="field-error">Enter an email address in the format name@example.com.</p>

  <button type="submit">Save</button>
  <button type="button" class="icon-button" aria-label="Delete draft">
    <svg aria-hidden="true" focusable="false"><use href="#icon-trash"/></svg>
  </button>

  <div role="status" aria-live="polite" class="visually-hidden" id="form-status"></div>
</form>
```
```css
:focus-visible { outline: 3px solid #1a5fb4; outline-offset: 2px; }
.icon-button { min-width: 44px; min-height: 44px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
### 2. Native equivalents (SwiftUI and Jetpack Compose)
```swift
Button(action: deleteDraft) {
    Image(systemName: "trash")
}
.accessibilityLabel("Delete draft")
.frame(minWidth: 44, minHeight: 44)
```
```kotlin
IconButton(onClick = onDeleteDraft) {                        // 48dp minimum touch target by default
    Icon(Icons.Outlined.Delete, contentDescription = "Delete draft")
}
```
### 3. Automated check in an end-to-end test (Playwright + axe)
```typescript
import AxeBuilder from '@axe-core/playwright';

test('checkout has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});
```
**Why it's right:**
- Native controls provide focus, keyboard support, and roles for free; icon buttons have names and adequate target sizes.
- Labels persist, errors are associated with fields, and status changes are announced politely.
- Focus is always visible, motion respects user preferences, and regressions are caught automatically.
