---
name: responsive-layout
description: "Responsive and adaptive layout for web and apps: mobile-first CSS, fluid grids with Flexbox and CSS Grid, container queries, breakpoints based on content, fluid typography with clamp, responsive images with srcset and sizes, touch targets, safe areas, reflow at 320 CSS pixels and 400% zoom, and adaptive layouts for tablets and foldables. Use it when designing or implementing layouts that must work across screen sizes and input types."
---

# Skill: Responsive Layout

## Implementation Rules:
- **[MANDATORY]** Design and build mobile first: start with the smallest supported viewport and progressively enhance with `min-width` media queries or container queries; content must reflow at 320 CSS pixels wide (WCAG 1.4.10) without horizontal scrolling, except for content that requires two dimensions (tables, maps).
- **[PATTERN]** Choose breakpoints from where the content breaks, not from device lists, and keep a small shared set of breakpoint tokens in the design system.
- **[PATTERN]** Use intrinsic layout techniques: CSS Grid with `repeat(auto-fit, minmax(16rem, 1fr))`, Flexbox with wrapping, `min()`/`max()`/`clamp()` for sizes, and logical properties (`margin-inline`, `padding-block`) for right-to-left support.
- **[PATTERN]** Use container queries (`container-type: inline-size`, `@container`) for components that appear in different contexts, so a card adapts to its container rather than to the viewport.
- **[PATTERN]** Scale typography fluidly with `clamp()` using `rem`-based values, keep line length around 45-75 characters, and never set font sizes in fixed pixels that ignore user settings.
- **[PERFORMANCE]** Serve responsive images: `srcset` with width descriptors and accurate `sizes`, modern formats (AVIF, WebP) with `<picture>` fallbacks, explicit `width` and `height` or `aspect-ratio` to prevent layout shift, and `loading="lazy"` below the fold.
- **[MANDATORY]** Support touch and pointer differences: targets of at least 24x24 CSS pixels (44x44 recommended for primary actions), hover-only interactions avoided or given alternatives (`@media (hover: hover)`), and spacing that prevents accidental taps.
- **[FORBIDDEN]** Fixed-width containers in pixels for main layout, `user-scalable=no` or `maximum-scale=1` in the viewport meta tag, hiding essential content or features on small screens, and separate mobile sites with divergent functionality.
- **[PATTERN]** Handle device specifics: `viewport-fit=cover` with `env(safe-area-inset-*)` for notches, dynamic viewport units (`dvh`) for full-height layouts on mobile browsers, orientation changes, and foldable or large-screen layouts (two-pane layouts, Android window size classes, iPad multitasking).
- **[PATTERN]** Keep source order logical: visual reordering with Grid or `order` must not break reading and focus order for keyboard and screen reader users.
- **[TESTING]** Test on real devices and emulators across widths (320, 375, 768, 1024, 1440+), at 200% and 400% zoom, with large system font sizes, in landscape, and with automated visual regression screenshots at key breakpoints.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
