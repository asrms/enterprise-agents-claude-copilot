---
name: multi-environment-layout
description: "Organizing infrastructure code for multiple environments, accounts, and regions: live vs modules repositories, directory-per-environment stacks, Terragrunt or Terraform Stacks, per-environment variables, account/subscription separation, promotion of module versions, and CI orchestration of plans and applies. Use it when structuring or reviewing an IaC repository for dev, staging, and production."
---

# Skill: Multi-Environment Layout

## Implementation Rules:
- **[ARCHITECTURE]** Separate reusable modules (versioned, environment-agnostic) from live configurations (one root stack per environment, component, and region); environments are isolated by cloud account, subscription, or project, with production in its own account(s).
- **[MANDATORY]** Each environment's stack pins the module versions it uses, so changes are promoted deliberately: a new module version is applied to dev, then staging, then production through separate pull requests or pipeline stages.
- **[PATTERN]** Use a directory-per-environment layout (`live/<env>/<region>/<component>`) with small `*.tfvars` or `terragrunt.hcl` files containing only real differences (sizes, counts, CIDRs, feature flags); DRY shared configuration with Terragrunt includes or Terraform Stacks where the team has adopted them.
- **[PATTERN]** Keep environments structurally identical: the same components and modules everywhere with different sizing, so staging is a faithful rehearsal of production; differences are explicit variables, not diverging code.
- **[FORBIDDEN]** `if var.environment == "prod"` branches scattered through modules, copy-pasted stacks that diverge, one state for several environments, and CLI workspaces as the only boundary between production and non-production.
- **[PATTERN]** Define dependencies between components explicitly (network before data before apps) and orchestrate them in CI (Terragrunt `run --all` with dependency blocks, Terraform Stacks, Atlantis/Spacelift/HCP Terraform project dependencies, or ordered pipeline jobs).
- **[MANDATORY]** CI plans every affected stack on pull requests, posts the plan summary for review, and applies only after approval using per-environment identities (OIDC roles scoped to one account and environment).
- **[PATTERN]** Region and account metadata (ids, CIDR allocations, DNS zones) live in a single, reviewed data source (a `globals` file or an account vending output) instead of being repeated across stacks.
- **[PATTERN]** Ephemeral environments (per pull request or per feature) reuse the same modules with a unique prefix and are destroyed automatically after merge or expiry.
- **[TESTING]** Changes to shared modules trigger plans in all consuming stacks to reveal impact, and the pipeline blocks production applies whose plans contain unexpected destroy actions without explicit approval.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
