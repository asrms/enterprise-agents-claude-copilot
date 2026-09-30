---
name: readme-standards
description: "Writing effective README files and project entry documentation: purpose and audience, quick start that works on the first try, prerequisites, installation, usage examples, configuration reference, contribution and support links, badges used sparingly, license, security contact, and keeping the README accurate with automated checks. Use it when creating or reviewing README files for repositories, libraries, services, or tools."
---

# Skill: README Standards

## Implementation Rules:
- **[MANDATORY]** Open with what the project is and who it is for in one or two sentences, followed by the problem it solves; readers should know within seconds whether they are in the right place.
- **[MANDATORY]** Provide a quick start that works on a clean machine: prerequisites with versions, installation commands, and a minimal example with expected output; test it regularly because a broken first step loses users immediately.
- **[PATTERN]** Structure consistently: overview, quick start, usage (common tasks with examples), configuration (options, environment variables with defaults), architecture or project structure pointer, development setup, testing, contributing, support, security, license.
- **[PATTERN]** Keep the README an entry point, not the whole manual: link to detailed docs (docs site, ADRs, API reference, runbooks) instead of duplicating them.
- **[PATTERN]** Show real, copyable examples in fenced code blocks with the language specified, using placeholders that are clearly marked (`<your-api-key>`) and never real secrets.
- **[MANDATORY]** Document configuration completely: every environment variable or option with purpose, type, default, and whether it is required, ideally generated from the source of truth (schema or settings class).
- **[PATTERN]** For services, include how to run locally (for example Docker Compose), how to run tests, main dependencies, ownership (team and contact channel), and links to dashboards and runbooks.
- **[FORBIDDEN]** Outdated instructions, "TODO" sections in published READMEs, walls of badges that hide the content, secrets or internal hostnames in public repositories, and instructions that only work on the author's machine.
- **[PATTERN]** Add community files where relevant: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` with a private vulnerability reporting channel, `LICENSE`, and issue and pull request templates.
- **[PATTERN]** Write for scanning: short sections with descriptive headings, lists for steps, tables for options, and a table of contents for long files; use relative links so they work in forks and mirrors.
- **[TESTING]** Check READMEs automatically in CI: link checking (lychee or markdown-link-check), Markdown linting (markdownlint), and executing quick-start commands or doc tests where feasible.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
