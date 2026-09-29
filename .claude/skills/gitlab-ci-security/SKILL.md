---
name: gitlab-ci-security
description: "Securing GitLab CI/CD: protected branches, tags, and environments, protected and masked variables, OIDC ID tokens (id_tokens) for keyless cloud access, CI/CD job token scope, secrets from Vault or cloud secret managers, pipelines for merge requests from forks, runner isolation, image pinning, and GitLab security scanners (SAST, dependency scanning, secret detection, container scanning). Use it when hardening GitLab pipelines or reviewing their security."
---

# Skill: GitLab CI/CD Security

## Implementation Rules:
- **[SECURITY]** Protect the default branch, release tags (for example `v*`), and production environments; only protected refs may deploy, and protected environments require approvals from a defined group with deployer access restricted to maintainers or a release team.
- **[MANDATORY]** Mark every production credential as a protected, masked (preferably masked and hidden) variable scoped to the environment that needs it (`environment_scope: production`), so it is never exposed to pipelines on unprotected branches or to other environments.
- **[SECURITY]** Prefer OIDC over static cloud keys: request short-lived tokens with `id_tokens` and a specific `aud`, and restrict the cloud trust policy on `sub`, `project_path`, `ref`, `ref_type`, `ref_protected`, and `environment` claims so only the intended project, ref, and environment can assume the role.
- **[PATTERN]** Fetch secrets at job runtime with the `secrets:` keyword from HashiCorp Vault (JWT auth with `id_tokens`), AWS Secrets Manager, Azure Key Vault, or Google Secret Manager, preferring file-type secrets and never writing them to artifacts or cache.
- **[SECURITY]** Restrict the CI/CD job token: keep the job token allowlist (inbound access) limited to explicitly authorized projects and grant only the fine-grained permissions each consumer needs.
- **[SECURITY]** Treat merge requests from forks as untrusted: their pipelines run without protected variables by default; never run fork code in the parent project with secrets unless a maintainer has reviewed it, and avoid automatic triggers that bypass this review.
- **[SECURITY]** Isolate runners: use ephemeral, autoscaled runners (Kubernetes, Docker autoscaler, or instance executors) per job, separate runners for protected and production jobs via tags and protected runners, no privileged Docker-in-Docker where rootless BuildKit or Kaniko alternatives work, and least-privilege runner service accounts.
- **[MANDATORY]** Pin images by version or digest (never `latest`), pin included components and projects to versions or tags, and use a trusted internal registry or the Dependency Proxy for base images.
- **[PATTERN]** Enable GitLab security scanners (SAST, secret detection, dependency scanning, container scanning, and DAST or IaC scanning where relevant) through templates or components, and enforce results with merge request approval policies instead of optional jobs.
- **[FORBIDDEN]** Unprotected variables holding production secrets, `CI_DEBUG_TRACE` or `set -x` in jobs with secrets, `echo`ing credentials, `curl | bash` installers, `include: remote` from untrusted URLs, and deploy jobs that run on any branch.
- **[CONFIGURATION]** Protect `.gitlab-ci.yml`, CI components, and deployment scripts with CODEOWNERS and required approvals, and use pipeline execution policies or compliance pipelines at the group level to guarantee mandatory security jobs cannot be removed.
- **[TESTING]** Verify controls periodically: attempt a deploy from an unprotected branch and confirm it fails, check that masked values never appear in job logs, audit variables and job token allowlists, and review the audit events for changes to protected settings.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
