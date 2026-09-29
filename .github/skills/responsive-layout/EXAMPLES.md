# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Desktop-first fixed layout
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  .page    { width: 1200px; margin: 0 auto; }
  .sidebar { float: left; width: 300px; }
  .content { float: left; width: 900px; font-size: 14px; }
  @media (max-width: 768px) { .sidebar { display: none; } }   /* filters disappear on mobile */
  .product img { width: 600px; }                                /* one huge image for every device */
</style>
```
**Why it's wrong:**
- Zoom is disabled and fixed widths force horizontal scrolling on small screens.
- Essential features are hidden on mobile, and every device downloads the largest image.

## Best Practice (How to do it right)

### 1. Intrinsic grid, container query card, fluid type
```css
:root { --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem); --step-2: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem); }
body  { font-size: var(--step-0); }
h1    { font-size: var(--step-2); }

.layout {
  display: grid;
  gap: 1.5rem;
  padding-inline: max(1rem, env(safe-area-inset-left));
}
@media (min-width: 60rem) {
  .layout { grid-template-columns: 18rem 1fr; }          /* filters beside results only when there is room */
}

.results { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }

.card-wrapper { container-type: inline-size; }
.card { display: grid; gap: 0.75rem; }
@container (min-width: 28rem) {
  .card { grid-template-columns: 8rem 1fr; }             /* horizontal card when its container is wide */
}
```
### 2. Responsive image without layout shift
```html
<img
  src="/img/shoe-800.avif"
  srcset="/img/shoe-400.avif 400w, /img/shoe-800.avif 800w, /img/shoe-1600.avif 1600w"
  sizes="(min-width: 60rem) 30vw, 90vw"
  width="800" height="600"
  alt="Trail running shoe, blue, side view"
  loading="lazy" decoding="async">
```
**Why it's right:**
- The layout adapts to available space, keeps filters available on small screens (in a collapsible panel), and allows zoom.
- Components respond to their container, typography scales fluidly, and images are sized per device without shifting the layout.
