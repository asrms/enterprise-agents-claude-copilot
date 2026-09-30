---
name: changelog-release-notes
description: "Writing and maintaining changelogs and release notes: Keep a Changelog structure, an Unreleased section, generated vs curated entries, audience-specific release notes for users, operators, and developers, breaking changes with migration steps, deprecation notices, security advisories, and linking to issues and versions. Use it when preparing a release or reviewing how changes are communicated."
---

# Skill: Changelog and Release Notes

## Implementation Rules:
- **[MANDATORY]** Every released artifact has a human-readable `CHANGELOG.md` in the repository, newest version first, with a version number and ISO 8601 date per release (`## [2.4.0] - 2026-09-29`) and an `## [Unreleased]` section collecting changes before release.
- **[PATTERN]** Group entries using the Keep a Changelog categories: Added, Changed, Deprecated, Removed, Fixed, Security; each entry is one line written for the reader, in the imperative or past tense consistently, with a link to the issue or pull request.
- **[PATTERN]** Generate the draft from structured history (Conventional Commits via release-please, semantic-release, git-cliff, or Changesets entries) and curate it before release: merge noisy entries, remove internal-only changes (`ci`, `chore`, refactors), and rewrite for clarity.
- **[MANDATORY]** Breaking changes appear first, marked clearly, with the impact, the reason, and concrete migration steps or a link to a migration guide; deprecations state the replacement and the removal version or date.
- **[PATTERN]** Tailor release notes to the audience: end users (benefits and visible changes, no jargon), operators (configuration changes, new environment variables, migrations, rollback notes), and developers (API changes, new endpoints, SDK updates); publish them where each audience looks (in-app, store listing, GitHub Releases, docs).
- **[SECURITY]** Security fixes are listed under Security with the CVE or advisory identifier and affected versions once disclosure is appropriate, coordinated with the security advisory process; never disclose exploit details before users can update.
- **[PATTERN]** Link versions to comparisons and tags (`[2.4.0]: https://github.com/example/shop/compare/v2.3.1...v2.4.0`) and keep the changelog consistent with Git tags and published artifacts.
- **[FORBIDDEN]** Raw commit dumps as release notes, entries like "misc fixes" or "improvements", rewriting the entries of already released versions (except to fix errors, noted as such), and omitting breaking changes or data migrations.
- **[PATTERN]** Store-facing release notes for mobile apps are short, localized, and focused on user value; long technical notes stay in the changelog.
- **[PATTERN]** Contributors add changelog entries (or Changesets files) in the same pull request as the change when the project curates entries by hand, and reviewers check them as part of the definition of done.
- **[TESTING]** CI checks that user-visible pull requests include a changelog entry or a conventional title that produces one, validates the changelog format (for example with a Keep a Changelog linter), and verifies that the release version exists in the changelog before publishing.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
