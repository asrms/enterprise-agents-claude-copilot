---
name: accessibility-testing
description: "Testing accessibility (WCAG 2.2 AA) for web apps in any framework: automated checks with axe-core in unit/component and end-to-end tests, keyboard and focus tests, screen reader test plans (NVDA, VoiceOver), contrast and zoom checks, CI gates, and reporting. Use it when planning or implementing accessibility verification."
---

# Skill: Accessibility Testing

## Implementation Rules:
- **[ARCHITECTURE]** Combine three layers: automated rules (axe-core) catch roughly a third of WCAG issues, scripted keyboard/focus tests catch interaction issues, and manual assistive technology checks catch the rest; none replaces the others.
- **[MANDATORY]** Target WCAG 2.2 level AA: in axe use tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; zero violations on every key page and component state (empty, loading, error, open dialog, validation errors).
- **[PATTERN]** Automated checks at component level with `jest-axe`/`vitest-axe` (`expect(await axe(container)).toHaveNoViolations()`) and at page level with `@axe-core/playwright` (`new AxeBuilder({ page }).withTags([...]).analyze()`), Cypress (`cypress-axe`), or Selenium (`axe-core/webdriverjs`).
- **[MANDATORY]** Keyboard tests for every interactive flow: all controls reachable with Tab in a logical order, visible focus, activation with Enter/Space, Escape closes dialogs and menus, focus moves into opened dialogs and returns to the trigger on close, no keyboard traps.
- **[PATTERN]** Use role- and name-based queries in tests (`getByRole('button', { name: 'Save' })`): a test that cannot find an element by its accessible name has found an accessibility bug.
- **[PATTERN]** Manual screen reader test plan per release for critical journeys: NVDA + Firefox/Chrome and JAWS on Windows, VoiceOver + Safari on macOS/iOS, TalkBack + Chrome on Android; check announcements of headings, landmarks, form labels and errors, live regions, and dynamic content.
- **[PATTERN]** Visual checks: text contrast ≥ 4.5:1 (3:1 for large text and UI components), content usable at 200% zoom and reflow at 320 CSS px without horizontal scrolling, `prefers-reduced-motion` honored, target size ≥ 24×24 CSS px.
- **[FORBIDDEN]** Disabling axe rules globally to make the build green; exclusions are local (`exclude` selectors or `disableRules` on a specific test) with a ticket and justification, and third-party widgets outside your control are reported upstream.
- **[CONFIGURATION]** CI gate: accessibility checks run with the other tests on every PR; new violations fail the build; a baseline of known legacy violations (with tickets) is allowed only temporarily and must shrink over time.
- **[PATTERN]** Static analysis in the editor and CI (`eslint-plugin-jsx-a11y`, `@angular-eslint/template` accessibility rules, `eslint-plugin-vuejs-accessibility`) prevents common mistakes before tests run.
- **[PATTERN]** Report findings with the WCAG success criterion (e.g. 1.4.3 Contrast), impact, affected users, steps to reproduce with the assistive technology used, and the fix; prioritize blockers for task completion (cannot submit a form, cannot close a dialog).
- **[TESTING]** Mobile apps: use platform tools (Android Accessibility Scanner, Espresso accessibility checks, Xcode Accessibility Inspector, XCUITest with accessibility identifiers) plus manual TalkBack/VoiceOver checks.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
