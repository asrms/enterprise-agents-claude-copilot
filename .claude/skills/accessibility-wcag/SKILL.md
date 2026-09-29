---
name: accessibility-wcag
description: "Framework-agnostic accessibility to WCAG 2.2 level AA for web and native apps: semantic structure and roles, accessible names, keyboard and focus management, color contrast, text resizing and Dynamic Type, motion, forms and error messages, target size, and testing with axe, Lighthouse, VoiceOver, TalkBack, and screen readers. Use it when building or reviewing any user interface."
---

# Skill: Accessibility (WCAG 2.2 AA)

## Implementation Rules:
- **[MANDATORY]** Target WCAG 2.2 level AA as the minimum for every screen, including the criteria added in 2.2 (focus not obscured, dragging alternatives, minimum target size of 24x24 CSS pixels, consistent help, redundant entry, accessible authentication).
- **[MANDATORY]** Use native semantics first: real `<button>`, `<a href>`, `<label>`, headings in order, landmarks (`<header>`, `<nav>`, `<main>`), lists, and tables with headers on the web; standard controls on iOS and Android. Add ARIA only when no native element exists, and follow the ARIA Authoring Practices patterns when you do.
- **[MANDATORY]** Every interactive element and meaningful image has an accessible name (visible label, `aria-label`, `alt`, `accessibilityLabel`, `contentDescription`); decorative images are hidden from assistive technology (`alt=""`, `aria-hidden="true"`, `.accessibilityHidden(true)`, `contentDescription = null`).
- **[MANDATORY]** Everything works with a keyboard and switch access: logical focus order, visible focus indicators with sufficient contrast, no keyboard traps, skip links for repeated navigation, and focus moved deliberately on route changes, dialogs (trap and restore focus), and deletions.
- **[MANDATORY]** Color contrast is at least 4.5:1 for normal text, 3:1 for large text and for UI components and focus indicators; information is never conveyed by color alone.
- **[PATTERN]** Support text scaling and reflow: content remains usable at 200% zoom and 320 CSS pixels width without horizontal scrolling on the web, and with the largest Dynamic Type/font scale on iOS and Android; use relative units and flexible layouts, never fixed-height text containers.
- **[PATTERN]** Forms: every field has a persistent visible label, required fields and formats are stated up front, errors are described in text next to the field and announced (`aria-describedby`, `aria-invalid`, live region or focus on an error summary), and `autocomplete` attributes identify personal data fields.
- **[PATTERN]** Dynamic content announces changes to assistive technology with polite live regions (`role="status"`) or platform announcements (`AccessibilityNotification.Announcement` on iOS, `announceForAccessibility`/live regions in Compose), without stealing focus unnecessarily.
- **[PATTERN]** Respect user preferences: `prefers-reduced-motion`/Reduce Motion (no parallax or auto-playing animation longer than 5 seconds without controls), dark mode contrast, and captions or transcripts for audio and video.
- **[FORBIDDEN]** Clickable `<div>`/`<span>` elements without role and keyboard support, `outline: none` without a replacement focus style, placeholder-only labels, `tabindex` values greater than 0, disabling zoom (`user-scalable=no`), and time limits without a way to extend them.
- **[TESTING]** Automate what can be automated (axe-core in component and end-to-end tests, Lighthouse or pa11y in CI, Android Accessibility Test Framework, Xcode Accessibility Inspector audits), and test manually each release with keyboard only and with a screen reader (NVDA or JAWS, VoiceOver, TalkBack), since automated tools find only part of the issues.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
