---
name: docs-as-code
description: "Managing documentation like code: Markdown or AsciiDoc in the repository next to the code, the Diataxis framework (tutorials, how-to guides, reference, explanation), static site generators (MkDocs Material, Docusaurus, Antora, Sphinx), pull request reviews with CODEOWNERS, linting with Vale and markdownlint, link checking, preview deployments, versioning, and ownership and freshness metadata. Use it when setting up or improving a documentation workflow or site."
---

# Skill: Docs as Code

## Implementation Rules:
- **[MANDATORY]** Keep documentation in version control next to the code it describes (`docs/` in the repository, or a docs repository for cross-cutting content), written in plain-text formats (Markdown, AsciiDoc, reStructuredText), and changed through pull requests.
- **[MANDATORY]** Update documentation in the same pull request as the behavior change; the definition of done includes docs, and reviewers check them.
- **[ARCHITECTURE]** Organize content with the Diataxis framework: tutorials (learning by doing), how-to guides (task-oriented steps), reference (precise, complete, generated where possible), and explanation (concepts, architecture, decisions); do not mix types on one page.
- **[PATTERN]** Build and publish with a static site generator (MkDocs with Material, Docusaurus, Antora, Sphinx, or Hugo) from CI, with navigation, search, and versioned documentation for products with multiple supported versions.
- **[PATTERN]** Assign ownership with CODEOWNERS for documentation paths and add page metadata (owner, last reviewed date) so stale content can be detected and reviewed.
- **[MANDATORY]** Lint and validate in CI: prose style with Vale (house style rules, terminology), Markdown structure with markdownlint, broken links with lychee or an equivalent, spelling, and build warnings treated as errors.
- **[PATTERN]** Deploy preview builds for every documentation pull request so reviewers see rendered pages, diagrams, and navigation before merging.
- **[PATTERN]** Generate reference content from sources of truth: API reference from contracts, CLI reference from command definitions, configuration reference from schemas, and diagrams from code (see diagrams as code).
- **[FORBIDDEN]** Documentation only in wikis disconnected from code review, binary documents (Word, PDF) as the source of truth for technical docs, copy-pasted content in several places, and pages without an owner.
- **[PATTERN]** Write for findability: descriptive titles, one topic per page, stable URLs with redirects when pages move, and a clear landing page that routes readers by goal.
- **[TESTING]** Test documentation: run code snippets or doc tests where possible, check that tutorials work end to end periodically, and collect feedback (page ratings, search terms without results) to prioritize improvements.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
