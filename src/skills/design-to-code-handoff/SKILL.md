---
name: design-to-code-handoff
description: "Effective collaboration between design and engineering: design specs with all states and edge cases, Figma Dev Mode and variables mapped to design tokens, component mapping with Code Connect or documented equivalents, annotations for accessibility and behavior, responsive rules, redlines vs tokens, design QA and visual review in pull requests, and keeping design and code in sync. Use it when preparing designs for implementation or reviewing whether an implementation matches the design."
---

# Skill: Design to Code Handoff

## Implementation Rules:
- **[MANDATORY]** Hand off designs built from the design system: components from the shared library and styles bound to variables that map one-to-one to code design tokens; detached components and raw values are flagged before handoff.
- **[MANDATORY]** Specify every state and edge case, not only the happy path: loading, empty, error, partial data, long text and truncation, localization expansion (around 30% longer strings), right-to-left where supported, permissions differences, and offline.
- **[MANDATORY]** Annotate accessibility: heading levels, landmarks, reading and focus order, accessible names for icons, focus management on dialogs and route changes, keyboard interactions, announcements for dynamic updates, and alternative text.
- **[PATTERN]** Define responsive behavior explicitly: layouts at key breakpoints, what reflows, stacks, or collapses, and which elements are fixed or fluid, rather than only one desktop frame.
- **[PATTERN]** Map design components to code components (Figma Code Connect or a documented mapping table) with the same names, props, and variants, so engineers know exactly what to use.
- **[PATTERN]** Describe interactions and motion with parameters: triggers, transitions, durations and easing from motion tokens, and reduced-motion alternatives; use prototypes for complex flows.
- **[PATTERN]** Involve engineering early (feasibility, data availability, performance constraints) and design in delivery (answering questions, reviewing implementation) instead of a one-way throw over the wall.
- **[FORBIDDEN]** Pixel redlines as the source of truth instead of tokens, designs that silently introduce new components or colors outside the design system, handoffs without error and empty states, and "final_v3_really_final" files without a clear ready-for-development status.
- **[PATTERN]** Mark design readiness explicitly (sections or pages with "ready for dev" status, linked stories), and version changes after handoff with change notes so engineers see what changed.
- **[PATTERN]** Run design QA before release: designers review the implementation in a preview environment or pull request (screenshots, Storybook, visual diffs) against the specs, with issues tracked like bugs.
- **[TESTING]** Protect the result with visual regression tests on components and key screens, automated accessibility checks, and periodic audits comparing design library and code library for drift.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
