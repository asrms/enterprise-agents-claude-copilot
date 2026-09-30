---
name: oidc-cloud-auth
description: "Keyless authentication from CI/CD to cloud providers with OpenID Connect: GitHub Actions id-token to AWS IAM roles, Azure federated credentials, and GCP Workload Identity Federation, with trust policies restricted by repository, branch, environment, and workflow claims. Use it when a pipeline needs cloud or registry access without long-lived secrets."
---

# Skill: OIDC Cloud Authentication

## Implementation Rules:
- **[MANDATORY]** Pipelines authenticate to cloud providers with short-lived OIDC federation (GitHub Actions `id-token: write` plus `aws-actions/configure-aws-credentials`, `azure/login` with federated credentials, `google-github-actions/auth` with Workload Identity Federation); long-lived access keys, service principal secrets, and JSON key files are removed.
- **[MANDATORY]** Trust policies restrict the token's claims precisely: audience (`sts.amazonaws.com`, `api://AzureADTokenExchange`), issuer, and subject scoped to the repository and the ref or environment (`repo:org/app:environment:production`, `repo:org/app:ref:refs/heads/main`); never wildcard the organization or repository.
- **[PATTERN]** Use separate roles/identities per repository and per environment with least-privilege permissions (deploy to one cluster, push to one registry, read one secret path), so a compromise of one pipeline cannot reach other environments.
- **[PATTERN]** Where available, customize the subject claim template (for example to include `job_workflow_ref` or repository ids) and pin the trust to a specific reusable workflow, so only the approved deployment workflow can assume production roles.
- **[MANDATORY]** Grant `id-token: write` only to jobs that need federation, not at the workflow level for every job, and never in workflows triggered by untrusted events (`pull_request_target` with checked-out PR code).
- **[SECURITY]** Keep session durations short (15-60 minutes), tag sessions with the run id for auditing, and monitor cloud audit logs (CloudTrail, Azure Activity Log, GCP Audit Logs) for role assumption from unexpected repositories or refs.
- **[PATTERN]** Define identity providers, roles, and trust policies as code (Terraform, Bicep, Pulumi) in a reviewed repository, not by hand in the console.
- **[PATTERN]** Use the same federation for registries and secret stores: ECR/ACR/Artifact Registry login through the cloud identity, and HashiCorp Vault JWT auth bound to repository and environment claims.
- **[FORBIDDEN]** Trust conditions using only `StringLike` on `repo:org/*`, identities with administrator or owner rights for deployment, and exporting the obtained credentials to artifacts, caches, or logs.
- **[TESTING]** Verify the trust boundaries: a workflow from a feature branch or another repository must fail to assume the production role; include this negative test when changing trust policies.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
