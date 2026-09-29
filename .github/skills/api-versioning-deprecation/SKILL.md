---
name: api-versioning-deprecation
description: "Evolving public and internal APIs without breaking clients: what counts as a breaking change, additive evolution and tolerant readers, versioning strategies (URI, header, media type, date-based), Deprecation and Sunset headers (RFC 9745, RFC 8594), migration guides, usage monitoring, and changelogs. Use it when changing, versioning, or retiring an API."
---

# Skill: API Versioning and Deprecation

## Implementation Rules:
- **[MANDATORY]** Know what breaks clients: removing or renaming fields, endpoints, enum values, or parameters; changing types, formats, or semantics; making optional inputs required; tightening validation; changing default values, status codes, error formats, pagination, or authentication requirements.
- **[PATTERN]** Prefer additive, backward-compatible evolution within a version: add optional request fields, add response fields, add endpoints and enum values (when clients are documented to tolerate unknown values), and relax validation.
- **[MANDATORY]** Document the tolerant reader contract for clients: ignore unknown fields, handle unknown enum values with a fallback, do not depend on field order or undocumented behavior.
- **[PATTERN]** Choose one versioning strategy per API and apply it consistently: major version in the URI path (`/v1/`) for public REST APIs (simple, visible, cacheable), a header or media type (`Accept: application/vnd.acme.v2+json`) when URIs must stay stable, date-based versions (`Api-Version: 2025-03-01`) for frequently evolving public APIs, package versions (`acme.orders.v2`) for gRPC/Protobuf.
- **[FORBIDDEN]** Breaking changes within a published version, versioning every minor change (v1, v2, v3 in a year), and running more than two or three major versions in parallel without a retirement plan.
- **[MANDATORY]** Deprecation is announced before removal: mark elements as deprecated in the contract (`deprecated: true` in OpenAPI, `@deprecated` in GraphQL, `[deprecated = true]` in Protobuf), return the `Deprecation` header (RFC 9745) and the `Sunset` header (RFC 8594) with the removal date, and add a `Link` to the migration guide (`rel="deprecation"` / `rel="sunset"`).
- **[PATTERN]** Sunset timelines by audience: internal consumers at least one release cycle with confirmed migration; external/public APIs typically 6–12 months or as stated in the API terms; security-driven removals may be shorter with direct communication.
- **[MANDATORY]** Measure before removing: track usage of deprecated endpoints, fields, and versions per client (API keys, OAuth client ids, user agents) and contact remaining users; remove only when usage is zero or accepted by the owners.
- **[PATTERN]** Provide migration guides with before/after examples, a mapping of old to new fields, and, when possible, tooling (SDK updates, codemods); run old and new versions in parallel through adapters rather than duplicating business logic.
- **[CONFIGURATION]** Automate breaking change detection in CI (`oasdiff breaking` for OpenAPI, `buf breaking` for Protobuf, `graphql-inspector diff` for GraphQL, schema registry compatibility for events) so a breaking change requires an explicit new version.
- **[PATTERN]** Keep a human-readable changelog per API (Keep a Changelog format) with Added/Changed/Deprecated/Removed/Fixed/Security sections and dates, linked from the documentation.
- **[SECURITY]** Old versions still in use receive security fixes until their sunset date; a version that cannot be patched is retired early with notice.
- **[TESTING]** Keep contract tests for every supported version and consumer-driven contracts for known consumers, so changes to shared code do not break an older version still in use.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
