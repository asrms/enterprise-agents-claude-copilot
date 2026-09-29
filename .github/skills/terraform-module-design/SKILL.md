---
name: terraform-module-design
description: "Designing reusable Terraform and OpenTofu modules: root vs child modules, standard file layout, typed variables with validation, outputs, provider and version constraints, composition over deep nesting, for_each over count, moved blocks for refactoring, documentation with terraform-docs, and module registries. Use it when writing or reviewing Terraform/OpenTofu code."
---

# Skill: Terraform Module Design

## Implementation Rules:
- **[ARCHITECTURE]** Separate root modules (deployable stacks per environment/component, with backend and provider configuration) from reusable child modules (no backend, no provider blocks with credentials); compose infrastructure from small, focused modules one level deep rather than deep module hierarchies.
- **[MANDATORY]** Modules follow the standard layout: `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` (with `required_version` and `required_providers` with version constraints), `README.md`, and `examples/`; the dependency lock file `.terraform.lock.hcl` is committed for root modules.
- **[MANDATORY]** Every variable has a `type`, a `description`, and `validation` blocks for business rules (allowed values, CIDR format, naming patterns); sensitive inputs are marked `sensitive = true`; use `optional()` attributes in object types for flexible yet typed inputs.
- **[PATTERN]** Expose a small, intention-revealing interface: sensible secure defaults (encryption on, public access off, logging on), and outputs for identifiers other stacks need (ids, ARNs, endpoints), marked `sensitive` when applicable.
- **[PATTERN]** Use `for_each` with maps or sets of stable keys to create multiple resources; use `count` only for conditional creation (`count = var.enabled ? 1 : 0`), because index-based addresses cause destructive reordering.
- **[PATTERN]** Refactor without destroying resources: `moved` blocks for renames and module extraction, `import` blocks for adopting existing resources, and `removed` blocks to stop managing resources safely.
- **[PATTERN]** Naming and tagging are centralized: a `locals` block builds names from conventions (`"${var.project}-${var.environment}-${var.component}"`), and provider `default_tags` (AWS) or common tag maps apply owner, environment, cost center, and data classification.
- **[FORBIDDEN]** Hard-coded account ids, regions, AMI ids, or secrets in modules; `provisioner` blocks for configuration management (use cloud-init, images, or configuration tools); `depends_on` on whole modules without need; and wrapper modules that only rename a single resource's arguments.
- **[PATTERN]** Version and publish shared modules (Git tags with SemVer or a private registry), consume them with pinned versions (`?ref=v1.4.0` or `version = "~> 1.4"`), and keep a changelog with upgrade notes for breaking changes.
- **[PATTERN]** Use data sources and remote state outputs sparingly for cross-stack dependencies; prefer explicit inputs or published parameters (SSM Parameter Store, tags) to keep stacks decoupled.
- **[TESTING]** CI runs `terraform fmt -check -recursive`, `terraform validate`, `tflint` with provider rulesets, `terraform-docs` freshness checks, and module tests (`terraform test`) for every module change.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
