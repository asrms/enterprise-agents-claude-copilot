---
name: actions-security-hardening
description: "Supply-chain and runtime security for GitHub Actions: least-privilege GITHUB_TOKEN permissions, SHA-pinned actions, preventing script injection from untrusted contexts, safe pull_request_target and workflow_run usage, secret handling, artifact attestations, harden-runner, and scanning workflows with actionlint and zizmor. Use it when writing or auditing GitHub Actions workflows."
---

# Skill: GitHub Actions Security Hardening

## Implementation Rules:
- **[MANDATORY]** Set `permissions` explicitly at workflow level to the minimum (`contents: read`) and elevate per job only where needed (`packages: write`, `id-token: write`, `pull-requests: write`); set the organization default token permission to read-only.
- **[MANDATORY]** Pin every third-party action to a full-length commit SHA with a version comment (`uses: owner/action@<40-char-sha> # v1.2.3`) and keep them updated with Dependabot or Renovate; restrict allowed actions at the organization level to verified creators and an allow-list.
- **[FORBIDDEN]** Interpolating untrusted context values directly into `run` scripts (`${{ github.event.pull_request.title }}`, `github.head_ref`, issue bodies, commit messages, branch names); pass them through `env:` variables and reference them as quoted shell variables (`"$PR_TITLE"`).
- **[FORBIDDEN]** Checking out and executing pull request code in `pull_request_target` or `workflow_run` workflows that have secrets or write permissions; use `pull_request` for untrusted code and keep privileged follow-up steps separate, consuming only validated artifacts.
- **[SECURITY]** Secrets are scoped to environments and repositories that need them, never printed, never passed to untrusted actions, and never written into artifacts or caches; values derived from secrets are masked with `::add-mask::`; long-lived cloud credentials are replaced by OIDC.
- **[SECURITY]** Require approval for workflows from first-time and outside contributors, protect workflow files with CODEOWNERS, and use repository rulesets requiring reviews and status checks for changes under `.github/workflows`.
- **[PATTERN]** Use `persist-credentials: false` on `actions/checkout` unless the job must push, and avoid the `GITHUB_TOKEN` in steps that do not need it.
- **[SECURITY]** Produce provenance for released artifacts and images (`actions/attest-build-provenance`, SBOM attestations) and verify them at deployment (`gh attestation verify`), aligning with SLSA build levels.
- **[PATTERN]** Monitor and restrict runner egress where possible (`step-security/harden-runner` with an allow-list of endpoints), and never use self-hosted runners for public repositories.
- **[PATTERN]** Treat caches as untrusted across trust boundaries: do not restore caches produced by pull request workflows into release workflows, and include lock-file hashes in cache keys.
- **[TESTING]** Scan workflows in CI with `actionlint` and `zizmor` (or OpenSSF Scorecard) to detect injection, excessive permissions, unpinned actions, and dangerous triggers, failing the build on high-severity findings.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
