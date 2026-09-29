---
name: microcopy-content-design
description: "Writing interface text and content design: voice and tone guidelines, clear and concise microcopy for buttons, labels, hints, errors, empty states, confirmations, and notifications, plain language and readability, inclusive language, writing for localization and pluralization with ICU message format, content in the design system, and testing copy. Use it when writing or reviewing text that appears in a product's user interface."
---

# Skill: Microcopy and Content Design

## Implementation Rules:
- **[MANDATORY]** Write for the user's goal in plain language: short sentences, familiar words, active voice, and the most important information first; target a reading level appropriate for a broad audience (roughly grade 7-9) unless the audience is specialized.
- **[MANDATORY]** Label actions with specific verbs that describe the outcome ("Request return", "Delete draft"), not generic ones ("Submit", "OK", "Yes"); dialog buttons repeat the action ("Delete draft" / "Keep draft").
- **[MANDATORY]** Write error messages that say what happened, why if useful, and how to fix it, in human terms without blame or codes ("Enter a postal code with 5 digits"), placed next to the problem.
- **[PATTERN]** Make empty states useful: explain what will appear, why it is empty, and the next action ("You have no returns yet. Start a return from your order history.").
- **[PATTERN]** Keep labels visible and hints concise: field labels as nouns, helper text for format or reason ("We use your phone number only for delivery updates"), and placeholders never as the only label.
- **[PATTERN]** Define voice (consistent personality) and tone (adapted to the situation: calm and direct for errors, warm for success) in a content style guide that is part of the design system, including terminology and capitalization rules.
- **[MANDATORY]** Use inclusive, respectful language: avoid gendered defaults, ableist or culturally specific idioms, and jargon; describe people as they describe themselves.
- **[PATTERN]** Write for localization: complete sentences in resource files (no string concatenation), ICU message format for plurals, gender, and variables (`{count, plural, one {# item} other {# items}}`), room for text expansion, and context notes for translators.
- **[FORBIDDEN]** Hard-coded strings in components, humor in error or high-stress situations, vague confirmations ("Are you sure?"), all-caps text for emphasis, and technical terms or internal names exposed to users.
- **[PATTERN]** Keep terminology consistent with the domain glossary and across product, help center, emails, and notifications; the same thing always has the same name.
- **[TESTING]** Test copy with users (comprehension checks, five-second tests, A/B tests for critical calls to action), review with accessibility in mind (screen reader output, link text that makes sense out of context), and check translations in context before release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
