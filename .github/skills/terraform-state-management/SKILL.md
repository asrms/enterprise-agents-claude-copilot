---
name: terraform-state-management
description: "Safe Terraform/OpenTofu state management: remote backends with locking and encryption (S3 with native locking, Azure Storage, GCS, HCP Terraform), state isolation per environment and component, least-privilege backend access, sensitive data in state, state operations (import, moved, state rm), and recovery. Use it when configuring backends or performing state changes."
---

# Skill: Terraform State Management

## Implementation Rules:
- **[MANDATORY]** State is stored in a remote backend with locking and encryption at rest: S3 with `use_lockfile = true` (native S3 locking) and SSE-KMS, Azure Storage with blob lease locking, GCS, or HCP Terraform/Terraform Enterprise; local state files are never used for shared infrastructure or committed to Git.
- **[MANDATORY]** Isolate state per environment and per component (`network`, `data`, `app` for each of `dev`, `staging`, `prod`) with separate backend keys and preferably separate accounts or subscriptions for production; small state files reduce blast radius and lock contention.
- **[PATTERN]** Prefer separate root module directories or stacks per environment over Terraform CLI workspaces when environments differ in configuration or access; use workspaces only for identical, short-lived copies.
- **[SECURITY]** State contains secrets in plain text (passwords, keys, connection strings): restrict backend access to the pipeline identity and a few administrators, enable versioning on the storage for recovery, block public access, and audit access; use ephemeral resources and write-only arguments where available to keep secrets out of state.
- **[PATTERN]** Bootstrap the backend itself (bucket, key, lock) with a small dedicated stack or scripted process, documented and protected with deletion safeguards (versioning, `prevent_destroy`).
- **[MANDATORY]** State changes are code: use `moved`, `import`, and `removed` blocks reviewed in pull requests instead of ad hoc `terraform state mv`, `import`, or `rm` commands; if a manual state command is unavoidable, back up the state first and record the change.
- **[PATTERN]** Share outputs between stacks through explicit mechanisms (`terraform_remote_state` with read-only access to outputs, or published parameters) and avoid circular dependencies between stacks.
- **[FORBIDDEN]** Editing state files by hand, `terraform force-unlock` without confirming no run is active, running `apply` from laptops against production, and disabling locking.
- **[PATTERN]** Plans run in CI with read-only credentials and are applied from the saved plan file (`terraform plan -out tfplan` then `terraform apply tfplan`) with a separate, more privileged identity after approval.
- **[TESTING]** Regularly test state recovery (restore a previous state version to a sandbox) and verify that pipeline identities cannot read state of other environments.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
