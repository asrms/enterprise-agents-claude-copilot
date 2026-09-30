---
name: acceptance-criteria-gherkin
description: "Writing acceptance criteria and executable specifications: rule-based criteria vs Given/When/Then scenarios, specification by example and example mapping, declarative Gherkin style, scenario outlines with examples tables, covering edge cases and negative paths, non-functional criteria, and automating scenarios with Cucumber, SpecFlow/Reqnroll, Behave, or pytest-bdd. Use it when defining when a story is done or reviewing acceptance criteria."
---

# Skill: Acceptance Criteria and Gherkin

## Implementation Rules:
- **[MANDATORY]** Every story has acceptance criteria agreed by product, development, and testing before work starts; criteria describe observable behavior and outcomes, not implementation.
- **[PATTERN]** Discover criteria through example mapping: for each business rule, collect concrete examples (including counterexamples and edge cases) and capture open questions to resolve before development.
- **[PATTERN]** Choose the form that fits: a short rule-based checklist for simple behavior, and Given/When/Then scenarios for behavior with state, sequences, or several business rules.
- **[MANDATORY]** Write scenarios declaratively in business language ("Given a delivered order older than 30 days"), one behavior per scenario, with a single When; avoid UI mechanics (clicks, field ids, CSS selectors) in scenario text.
- **[PATTERN]** Use `Scenario Outline` with an `Examples` table for rule variations (boundaries, categories), and `Background` only for truly shared context; keep scenarios independent of each other.
- **[MANDATORY]** Cover the negative and boundary paths: invalid input, permission denied, limits and thresholds (exactly at the boundary, just below, just above), empty states, and failure of external dependencies where they affect users.
- **[PATTERN]** State non-functional criteria measurably where they apply to the story (for example, "the return request is confirmed within 2 seconds at the 95th percentile", "the form is operable with keyboard only").
- **[FORBIDDEN]** Vague criteria ("works correctly", "user-friendly", "fast"), scenarios that test many behaviors at once, imperative step-by-step UI scripts in Gherkin, and criteria added after the implementation to match what was built.
- **[PATTERN]** Automate key scenarios as executable specifications (Cucumber, Reqnroll, Behave, pytest-bdd, or plain tests named after the scenarios) at the lowest level that proves the behavior, usually the API or domain layer rather than the browser.
- **[PATTERN]** Keep a shared glossary of domain terms used in scenarios (ubiquitous language), and reuse step definitions through a small, well-named step library.
- **[TESTING]** A story is accepted only when all its criteria are demonstrably met in a test environment; automated scenarios run in CI and their results are visible to the product owner.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
