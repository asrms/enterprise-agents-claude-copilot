---
name: drift-management
description: "Detecting and resolving infrastructure drift between IaC and real cloud state: scheduled plan-based drift detection, refresh-only plans, reconciling or codifying manual changes, preventing click-ops with permissions and guardrails, lifecycle ignore_changes used correctly, and alerting. Use it when drift appears or when setting up drift detection for Terraform/OpenTofu stacks."
---

# Skill: Drift Management

## Implementation Rules:
- **[MANDATORY]** Detect drift continuously: a scheduled pipeline (daily for production) runs `terraform plan -detailed-exitcode` (exit code 2 means changes) or `terraform plan -refresh-only` for every stack, or uses the platform's drift detection (HCP Terraform health assessments, Spacelift, env0), and alerts the owning team.
- **[MANDATORY]** Every detected drift is triaged and resolved in code within an agreed time: either revert the manual change by applying the code, or codify the change in IaC through a pull request (including `import` blocks for resources created outside Terraform).
- **[PATTERN]** Use `terraform plan -refresh-only` and `terraform apply -refresh-only` only to accept intended external changes into state after review; never as a routine way to hide differences.
- **[PATTERN]** Use `lifecycle { ignore_changes = [...] }` narrowly for attributes legitimately managed elsewhere (autoscaling desired counts, tags added by external tools, image tags updated by deployment pipelines), with a comment explaining the owner of that attribute.
- **[FORBIDDEN]** `ignore_changes = all` to silence drift, repeated manual console changes in environments managed by IaC, and long-lived drift left unaddressed because "the plan is always noisy".
- **[SECURITY]** Prevent drift at the source: humans get read-only access to production consoles by default, write access through break-glass roles that are logged and time-limited, and organization guardrails (SCPs, Azure Policy, organization policies) block high-risk changes outside pipelines.
- **[PATTERN]** Keep plans quiet so drift is visible: fix perpetual diffs (provider normalization, JSON policy ordering with `jsonencode`, default values), pin provider versions, and review provider upgrade plans separately.
- **[PATTERN]** Record the resolution: drift alerts link to an issue with the cause (incident hotfix, external automation, provider change) so recurring sources are removed.
- **[PATTERN]** For resources owned by other controllers (Kubernetes operators, autoscalers, GitOps), define clear ownership boundaries so Terraform and the controller do not fight over the same fields.
- **[TESTING]** Periodically introduce a harmless controlled change in a non-production environment to verify that drift detection and alerting work end to end.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
