---
name: azure-pipelines-security
description: "Securing Azure Pipelines and Azure DevOps: service connections with workload identity federation instead of secrets, least-privilege scopes and per-environment connections, approvals and checks on protected resources (environments, service connections, agent pools, variable groups, secure files), secrets in Azure Key Vault-linked variable groups, pipeline permissions and project settings (job authorization scope, limit variables at queue time, protect access to repositories), forked pull request builds, and supply-chain controls. Use it when hardening Azure DevOps pipelines or reviewing their security."
---

# Skill: Azure Pipelines Security

## Implementation Rules:
- **[SECURITY]** Use Azure Resource Manager service connections with workload identity federation (OIDC) instead of service principal secrets or certificates, and convert existing secret-based connections; for other clouds use their OIDC federation with the pipeline token where supported.
- **[SECURITY]** Create separate service connections per environment and scope each identity to the smallest resource group or resource with least-privilege roles (for example Website Contributor, AcrPush) instead of subscription Owner or Contributor.
- **[MANDATORY]** Protect production resources with approvals and checks: environments, service connections, agent pools, variable groups, and secure files require approvals from a named group, business-hours or exclusive-lock checks where needed, and the Required template or branch control check (only `refs/heads/main` or release tags).
- **[SECURITY]** Do not grant "Grant access permission to all pipelines" on protected resources; authorize specific pipelines explicitly so a new or modified pipeline cannot use production credentials without review.
- **[MANDATORY]** Store secrets in variable groups linked to Azure Key Vault or mark them secret, never in YAML; map them explicitly into scripts through `env:` because secret variables are not exposed as environment variables automatically.
- **[CONFIGURATION]** Enable organization and project settings: limit job authorization scope to the current project (and to referenced repositories), protect access to repositories in YAML pipelines, limit variables that can be set at queue time, disable creation of classic pipelines, and restrict who can edit pipelines.
- **[SECURITY]** Treat pull requests from forks as untrusted: do not make secrets available to fork builds, require a team member's comment before fork builds run, and never run fork builds on self-hosted agents with access to internal networks.
- **[SECURITY]** Harden agents: Microsoft-hosted or ephemeral scale set and container agents for untrusted code, separate agent pools for production deployments protected by checks, and no persistent credentials on agents.
- **[FORBIDDEN]** Printing secrets or disabling log masking, `curl | bash` installers, `Contributor` on whole subscriptions for pipeline identities, personal access tokens in pipelines where the job access token or a service connection works, and secret values passed as pipeline parameters.
- **[PATTERN]** Build supply-chain controls into pipelines: pin tasks and images, pull packages through Azure Artifacts upstream sources, run secret scanning and dependency scanning (GitHub Advanced Security for Azure DevOps or equivalent), and generate an SBOM and signed artifacts for releases.
- **[CONFIGURATION]** Review the audit log and service connection usage history regularly, rotate remaining secrets automatically from Key Vault, and remove unused service connections, variable groups, and agent pools.
- **[TESTING]** Verify controls: attempt to use a production service connection from a non-main branch or unapproved pipeline and confirm the check blocks it, and confirm secrets are masked in logs and unavailable to fork builds.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
