# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One happy-path frame with redlines
```text
Figma page "Returns NEW final v3": one desktop frame with a filled form
Notes: "padding 17px, color #1F6FEB, font 15px"; custom button not in the library
Missing: mobile layout, errors, empty order history, loading, long product names, focus order
Handoff: link sent in chat on the day development starts
```
**Why it's wrong:**
- Engineers must invent most states, responsive behavior, and accessibility, and redlines duplicate or contradict tokens.
- A new unofficial component appears, and late handoff removes any chance of feasibility feedback.

## Best Practice (How to do it right)

### 1. Handoff checklist and spec excerpt
```text
Feature: Request a return (RET-12)          Status: Ready for development (2026-10-02)
Frames:   mobile 360, tablet 768, desktop 1280
States:   loading (skeleton), empty order history, eligible item, ineligible item (reason shown),
          submission error, success, long product name (2 lines, then ellipsis with full name in tooltip and accessible name)
Components: ReturnReasonSelect -> <Select> (design system v4), SubmitBar -> <StickyActionBar>, Toast -> <Toast variant="success">
Tokens:   only semantic variables used (checked with the linting plugin: 0 detached styles)
Accessibility annotations:
  - h1 "Return an item", h2 per order; focus moves to h1 on page load
  - Reason select: label "Why are you returning this item?"; error "Choose a reason" linked via aria-describedby
  - On submit success: focus moves to confirmation heading; toast also announced via role="status"
Motion:   step transition 200 ms (motion.duration.short, easing.standard); none with reduced motion
Changes after handoff: 2026-10-05 — added "Exchange" option as disabled with explanation (see change note)
```
### 2. Design QA in the pull request
```text
PR #812 "feat(returns): request a return (RET-12)"
- Storybook preview: ReturnForm states (8) + Chromatic visual diff approved by design
- Design QA findings: [fixed] error text used color.text.secondary instead of color.text.danger
                     [open] tablet breakpoint: sticky bar overlaps last item (bug RET-44)
- axe: 0 violations; keyboard walkthrough recorded
```
**Why it's right:**
- The spec covers states, responsive frames, component and token mapping, accessibility, and motion, with a clear readiness status and change log.
- Design verifies the implementation in the pull request with visual diffs, and gaps are tracked as bugs.
