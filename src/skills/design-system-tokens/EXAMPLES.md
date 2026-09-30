# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Hard-coded values and appearance-based names
```css
.checkout-button { background: #1f6feb; color: #fff; padding: 9px 17px; border-radius: 5px; }
.cancel-link    { color: #999; font-size: 13px; }            /* contrast 2.8:1 on white */
.card           { background: #ffffff; }                     /* breaks in dark mode */
:root { --blue-button-color: #1f6feb; }                      /* name describes appearance */
```
**Why it's wrong:**
- Values are duplicated and drift between screens; theming and dark mode require hunting through every file.
- The grey link fails contrast, and token names tie meaning to a color that may change.

## Best Practice (How to do it right)

### 1. Tiered tokens in W3C format
`tokens/primitives.json`:
```json
{
  "color": {
    "blue": { "600": { "$type": "color", "$value": "#1f5fd1" }, "300": { "$type": "color", "$value": "#8ab4f8" } },
    "neutral": { "0": { "$type": "color", "$value": "#ffffff" }, "900": { "$type": "color", "$value": "#15181e" }, "700": { "$type": "color", "$value": "#4a5160" } }
  },
  "space": { "200": { "$type": "dimension", "$value": "8px" }, "400": { "$type": "dimension", "$value": "16px" } }
}
```
`tokens/semantic.light.json`:
```json
{
  "color": {
    "action": { "primary": { "background": { "$type": "color", "$value": "{color.blue.600}" } } },
    "text": { "primary": { "$type": "color", "$value": "{color.neutral.900}" }, "secondary": { "$type": "color", "$value": "{color.neutral.700}" } },
    "surface": { "default": { "$type": "color", "$value": "{color.neutral.0}" } }
  },
  "space": { "inset": { "md": { "$type": "dimension", "$value": "{space.400}" } } }
}
```
### 2. Components consume semantic tokens (generated CSS custom properties)
```css
.button--primary {
  background: var(--color-action-primary-background);
  color: var(--color-action-primary-foreground);
  padding: var(--space-inset-sm) var(--space-inset-md);
  border-radius: var(--radius-control);
  min-height: 44px;
}
.button--primary:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: 2px;
}
```
**Why it's right:**
- Primitives hold raw values, semantic tokens express intent, and themes change values without renaming.
- Components use only semantic tokens, include focus and target-size requirements, and the pipeline generates outputs for every platform.
