---
name: api-governance-spectral
description: "API governance as code: a shared style guide enforced with Spectral rulesets for OpenAPI and AsyncAPI, custom rules and severities, CI gates on pull requests, breaking change checks, API catalog and ownership metadata, and a lightweight design review process. Use it when standardizing APIs across teams or reviewing API contracts at scale."
---

# Skill: API Governance with Spectral

## Implementation Rules:
- **[ARCHITECTURE]** Governance is automated first and human second: a written API style guide defines conventions, and every rule that can be checked mechanically is implemented as a Spectral (or Redocly/Vacuum) rule; human design reviews focus on domain modeling and usability.
- **[MANDATORY]** Maintain a shared ruleset in its own repository or package (`@acme/spectral-ruleset`), versioned and released like code; API repositories extend it in `.spectral.yaml` (`extends: ["spectral:oas", "@acme/spectral-ruleset"]`) and may only tighten, not loosen, error-level rules.
- **[PATTERN]** Start from the built-in `spectral:oas` and `spectral:asyncapi` rulesets, and add company rules for: naming (kebab-case paths, camelCase properties), required `operationId`/`summary`/`tags`/`description`, error responses using `application/problem+json`, security defined on every operation, pagination parameters on collection GETs, maximum lengths on strings, no verbs in paths, and versioning conventions.
- **[MANDATORY]** Severities have meaning: `error` blocks merges (security, breaking conventions, missing error responses), `warn` is reported on the PR and tracked, `info`/`hint` are guidance; do not ship rules nobody fixes.
- **[PATTERN]** Custom rules use core functions (`pattern`, `casing`, `truthy`, `enumeration`, `schema`, `length`) and JSONPath `given` expressions; complex checks are implemented as custom JavaScript functions with unit tests for the ruleset itself.
- **[CONFIGURATION]** CI gate on every PR that changes an API contract: `spectral lint api/openapi.yaml --ruleset .spectral.yaml --fail-severity error --format github-actions` (or SARIF uploaded to code scanning), plus breaking change detection against the main branch (`oasdiff breaking --fail-on ERR`).
- **[PATTERN]** Exceptions are explicit: use Spectral `overrides` with file/path-specific rule relaxations and a comment linking the ticket or ADR; no blanket disabling of rules.
- **[PATTERN]** Every API has catalog metadata: owner team, lifecycle (experimental, stable, deprecated), audience (internal, partner, public), contact, and links to docs and runbooks, via `info.x-*` extensions or a catalog descriptor (Backstage `catalog-info.yaml` with `kind: API`).
- **[PATTERN]** Lightweight design review for new APIs and major versions: the contract PR is reviewed by an API guild member within an agreed time, using a checklist covering resource modeling, error handling, pagination, security, and evolution.
- **[FORBIDDEN]** Governance that only exists as a wiki page, manual approvals for every minor change, and rules applied retroactively to all legacy APIs at once; adopt new rules with warnings first and a migration period.
- **[SECURITY]** Security rules are always `error`: authentication required unless explicitly public, no API keys in query parameters, HTTPS-only servers, and no sensitive data in paths.
- **[TESTING]** Test the ruleset with fixture specs that must pass and specs that must fail each rule, so ruleset changes do not silently stop detecting problems.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
