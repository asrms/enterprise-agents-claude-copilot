---
name: gitlab-ci-components
description: "Reusing GitLab CI/CD configuration at scale: CI/CD components and the CI/CD Catalog, spec:inputs with types and defaults, include:component with pinned versions, include:project with ref, templates with extends and !reference, versioning and releasing components, testing components, and governance with pipeline execution policies and compliance frameworks. Use it when standardizing pipelines across many GitLab projects."
---

# Skill: GitLab CI Components and Templates

## Implementation Rules:
- **[ARCHITECTURE]** Package reusable pipeline logic as GitLab CI/CD components in dedicated component projects (`templates/<name>.yml` or `templates/<name>/template.yml`), published to the CI/CD Catalog, rather than copying YAML between projects.
- **[MANDATORY]** Declare component interfaces with `spec:inputs` including `type` (`string`, `number`, `boolean`, `array`), `default`, `description`, and `options` or `regex` validation, and reference them with `$[[ inputs.name ]]`; keep inputs few and meaningful.
- **[MANDATORY]** Consume components with pinned versions (`include: - component: $CI_SERVER_FQDN/group/components/node-build@1.4.0`) or a controlled major version tag; avoid `@main` or `~latest` in production pipelines.
- **[PATTERN]** Version components with Semantic Versioning, release them through a release job that creates a tag and a release (which publishes to the catalog), and document inputs and examples in the component project's README.
- **[PATTERN]** Test components in their own project: a pipeline that includes the component from the current commit (`$CI_COMMIT_SHA`) with representative inputs and verifies the resulting jobs succeed.
- **[PATTERN]** For configuration shared within an instance but not suited to components, use `include: project:` with an explicit `ref` (tag) and `file`, and reuse snippets with `extends` and `!reference` tags.
- **[PATTERN]** Keep component jobs overridable in controlled ways: prefixed job names from inputs (`$[[ inputs.job_prefix ]]-build`), `stage` as an input, and documented variables rather than requiring consumers to redefine whole jobs.
- **[FORBIDDEN]** Hidden side effects in components (deploying without explicit inputs), secrets hard-coded in shared templates, remote includes from untrusted URLs, and breaking input changes without a major version bump.
- **[SECURITY]** Enforce mandatory jobs (security scans, compliance checks) with pipeline execution policies or compliance pipelines at the group level so projects cannot remove them, while components provide the implementation.
- **[PATTERN]** Maintain an internal catalog with ownership: each component has maintainers, a changelog, deprecation notices, and a migration guide for major versions; track adoption across projects.
- **[TESTING]** Lint component YAML and consumer configurations in CI (CI Lint API or `glab ci lint`), and roll out new major versions to pilot projects before announcing them broadly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
