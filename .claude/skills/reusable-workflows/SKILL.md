---
name: reusable-workflows
description: "Designing maintainable GitHub Actions: reusable workflows with workflow_call inputs, secrets, and outputs, composite actions, organization templates, versioning and pinning of shared workflows, concurrency groups, path filters, and keeping pipelines DRY across many repositories. Use it when creating or refactoring GitHub Actions workflows."
---

# Skill: Reusable Workflows

## Implementation Rules:
- **[ARCHITECTURE]** Standardize pipelines with reusable workflows (`on: workflow_call`) for whole job sequences (build-test-scan, deploy) and composite actions (`action.yml` with `runs: using: composite`) for reusable step sequences; keep them in a central repository (for example `org/ci-workflows`) or in `.github/workflows` of the same repository for local reuse.
- **[MANDATORY]** Reusable workflows declare typed `inputs` with descriptions and defaults, explicit `secrets` (prefer named secrets over `secrets: inherit` across repositories), and `outputs` mapped from job outputs; callers pass only what is needed.
- **[MANDATORY]** Callers reference shared workflows and actions by an immutable reference: a full commit SHA, or a protected release tag in an internal repository you control; never `@main` for third-party code.
- **[PATTERN]** Shared workflows are versioned with semantic version tags and a changelog, tested in their own repository (a test caller workflow), and upgraded in consumers via Dependabot or Renovate.
- **[PATTERN]** Keep workflows readable: one purpose per workflow file (`ci.yml`, `release.yml`, `deploy.yml`), descriptive `name` for workflows, jobs, and steps, and logic in scripts under version control (`scripts/ci/*.sh`) rather than long inline `run` blocks.
- **[PATTERN]** Use `concurrency` groups to cancel superseded runs on pull requests (`group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`) while never cancelling in-progress deployments to shared environments.
- **[PERFORMANCE]** Trigger only what is needed: `paths`/`paths-ignore` filters or a changes-detection job for monorepos, `workflow_dispatch` for manual runs, and scheduled jobs (`schedule`) for nightly or security scans instead of running everything on every push.
- **[FORBIDDEN]** Copy-pasting the same 200-line workflow across repositories, nested reusable workflows beyond what is necessary (the depth is limited and hard to debug), and passing secrets as plain `inputs`.
- **[PATTERN]** Use `jobs.<id>.outputs` and artifacts (`actions/upload-artifact`/`download-artifact`) to pass data between jobs; build once and promote the same artifact through later stages.
- **[PATTERN]** Starter workflows and required workflows (repository rulesets) are provided at the organization level so new repositories get the standard pipeline and mandatory checks automatically.
- **[TESTING]** Lint workflow files with `actionlint` (which includes shellcheck for `run` scripts) in CI, and validate composite actions and reusable workflows with a dedicated test workflow before tagging a release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
