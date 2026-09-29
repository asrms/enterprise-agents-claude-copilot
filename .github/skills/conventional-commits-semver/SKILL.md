---
name: conventional-commits-semver
description: "Commit and versioning conventions: Conventional Commits 1.0 types, scopes, breaking change markers and footers, enforcing them with commitlint and pull request title checks, Semantic Versioning 2.0 rules including pre-releases and 0.x, deriving versions automatically, versioning APIs vs packages vs apps, and monorepo versioning. Use it when defining or reviewing commit message and version number policies."
---

# Skill: Conventional Commits and SemVer

## Implementation Rules:
- **[MANDATORY]** Write commit messages (or squash-merge pull request titles) as Conventional Commits: `type(scope)!: description` with types such as `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`; the description is imperative, lowercase, and without a trailing period.
- **[MANDATORY]** Mark breaking changes explicitly with `!` after the type/scope and a `BREAKING CHANGE:` footer that explains what changed and how to migrate.
- **[PATTERN]** Use the body for the why and the footers for metadata (`Refs: ORD-142`, `Closes #381`, `Co-authored-by:`); keep one logical change per commit or pull request so the history and changelog stay meaningful.
- **[MANDATORY]** Enforce the convention automatically: commitlint with `@commitlint/config-conventional` in a commit-msg hook and in CI, or a pull request title check when squash-merging; define the allowed scopes for the repository.
- **[MANDATORY]** Version released artifacts with Semantic Versioning 2.0: MAJOR for incompatible API changes, MINOR for backward-compatible features, PATCH for backward-compatible fixes; `fix` maps to PATCH, `feat` to MINOR, breaking changes to MAJOR.
- **[PATTERN]** Use pre-release identifiers for candidates (`3.0.0-rc.1`, `3.0.0-beta.2`) and build metadata only for information (`+build.512`); in `0.y.z`, document that minor versions may break, and reach `1.0.0` once the public API is relied upon.
- **[PATTERN]** Define what the public API is for each artifact: libraries (exported types and functions), services (HTTP/event contracts, versioned separately in URLs or schemas), CLIs (commands and flags), apps (marketing version for users, build numbers for stores).
- **[PATTERN]** Derive versions from history with tooling (release-please, semantic-release, Changesets for JavaScript monorepos, GitVersion, cocogitto) rather than editing version numbers by hand.
- **[PATTERN]** In monorepos, choose between independent versioning per package (scoped tags like `payments-v1.4.0`) and fixed/lockstep versioning, and document the choice.
- **[FORBIDDEN]** Vague messages (`fix stuff`, `wip`, `update`), hiding breaking changes in `fix` commits, reusing or moving version tags, and bumping MAJOR for marketing reasons without a breaking change.
- **[TESTING]** CI validates commit messages or pull request titles, and API compatibility checks (for example public API diff tools, OpenAPI or schema breaking-change checks) verify that the computed version bump matches the actual change.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
