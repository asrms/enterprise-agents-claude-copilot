---
name: design-system-tokens
description: "Building and maintaining design systems: design tokens in the W3C Design Tokens format (primitive, semantic, and component tiers), theming and dark mode, token pipelines with Style Dictionary to CSS, iOS, and Android, component libraries with documented variants and states, accessibility built into components, versioning, contribution, and governance. Use it when creating, evolving, or auditing a design system or token architecture."
---

# Skill: Design Systems and Tokens

## Implementation Rules:
- **[ARCHITECTURE]** Structure tokens in tiers: primitive tokens (raw palette, spacing scale, type scale), semantic tokens that express intent (`color.text.primary`, `color.surface.danger`, `space.inset.md`), and optional component tokens (`button.primary.background`); components consume semantic or component tokens, never primitives or hard-coded values.
- **[MANDATORY]** Store tokens as the single source of truth in a versioned repository using the W3C Design Tokens Community Group format (`$value`, `$type`, aliases like `{color.blue.600}`), synchronized with the design tool (for example Figma variables) through a defined workflow.
- **[PATTERN]** Generate platform outputs automatically with a token pipeline (Style Dictionary or equivalent): CSS custom properties, SCSS or JavaScript modules, iOS asset catalogs or Swift constants, Android resources or Compose theme values.
- **[PATTERN]** Implement theming by swapping semantic token values (light, dark, high contrast, brands) while keeping names stable; respect `prefers-color-scheme` and user overrides.
- **[MANDATORY]** Build accessibility into tokens and components: color pairs that meet WCAG contrast (4.5:1 text, 3:1 UI and focus), visible focus styles, minimum target sizes, motion tokens with reduced-motion alternatives, and components that use correct semantics and keyboard behavior.
- **[PATTERN]** Document every component with purpose and usage guidance, anatomy, variants, states (default, hover, focus, active, disabled, loading, error, empty), content guidelines, accessibility notes, and code examples, for example in Storybook or a documentation site.
- **[PATTERN]** Version the design system with Semantic Versioning, publish changelogs, mark deprecations with replacement guidance and removal versions, and provide codemods for breaking changes where practical.
- **[FORBIDDEN]** Hard-coded hex values, pixel spacing, or font sizes in product code, one-off component forks in product teams, token names that describe appearance instead of intent at the semantic tier (`color.blue-button`), and undocumented breaking changes.
- **[PATTERN]** Govern contributions: a clear process for proposing new components or variants, criteria for inclusion (reuse across teams), and design and engineering review before release.
- **[PERFORMANCE]** Keep the runtime cost low: CSS custom properties for theming instead of runtime JavaScript styling where possible, tree-shakable component packages, and icons as optimized SVG sprites or components.
- **[TESTING]** Test components with visual regression tests (Chromatic, Playwright screenshots), automated accessibility checks (axe in Storybook), and unit or interaction tests; validate token files against the schema and contrast rules in CI.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
