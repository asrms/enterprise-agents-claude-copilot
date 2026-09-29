---
name: azure-repos-policies
description: "Governing Azure Repos Git repositories: branch policies (minimum reviewers, linked work items, comment resolution, merge strategies, build validation, status checks, automatically included code reviewers), branch and tag security permissions, protecting pipeline and infrastructure files, pull request templates, repository settings, cross-repository policies, and GitHub Advanced Security for Azure DevOps. Use it when setting up or reviewing repository and pull request governance in Azure DevOps."
---

# Skill: Azure Repos Branch Policies

## Implementation Rules:
- **[MANDATORY]** Protect the default and release branches with branch policies: at least one or two reviewers other than the author, reset votes on new pushes (or require re-approval on the most recent iteration), resolve all comments, and prohibit the most recent pusher from approving their own changes.
- **[MANDATORY]** Require build validation on protected branches: a pull request pipeline that must succeed, set to expire when the target branch updates, with path filters only when the skipped paths truly cannot affect the build.
- **[PATTERN]** Add required status checks from external services (security scanners, SonarQube or similar quality gates, license checks) and configure them as required or optional deliberately.
- **[PATTERN]** Automatically include code reviewers by path (the Azure Repos equivalent of CODEOWNERS), with required reviewer groups for sensitive paths such as `/.azure-pipelines/`, `/infra/`, database migrations, and authentication code.
- **[CONFIGURATION]** Limit merge types to the team's strategy (for example squash merge only for a linear history, or rebase and fast-forward), enable deleting the source branch after merge, and require linked work items for traceability where the process needs it.
- **[SECURITY]** Restrict branch permissions: deny direct pushes, force push, and policy bypass on protected branches to everyone except a small break-glass group whose bypasses are audited; restrict tag creation for release tags (`v*`) to release pipelines or maintainers.
- **[SECURITY]** Apply cross-repository policies at the project level for default branches (`refs/heads/main`) and branch name patterns, so new repositories are protected from creation without per-repository setup.
- **[SECURITY]** Enable GitHub Advanced Security for Azure DevOps (secret scanning with push protection, dependency scanning, and code scanning) or equivalent scanners, and block pull requests with new high-severity alerts.
- **[PATTERN]** Provide pull request templates (`.azuredevops/pull_request_template.md`) with a checklist for testing, migration impact, security, and documentation, and keep them short enough to be filled in honestly.
- **[FORBIDDEN]** Policy bypass granted to whole teams, build validation marked optional on protected branches, self-approval of pull requests, direct commits to `main`, and disabling policies temporarily without an audit trail.
- **[CONFIGURATION]** Manage policies as code with the Azure DevOps REST API, the Azure DevOps CLI (`az repos policy`), or the Terraform provider for Azure DevOps, so settings are reviewed, versioned, and consistent across repositories.
- **[TESTING]** Verify governance regularly: attempt a direct push and a self-approval on a test repository, review policy bypass events in the audit log, and report repositories whose default branch lacks required policies.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
