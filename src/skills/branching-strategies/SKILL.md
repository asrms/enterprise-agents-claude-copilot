---
name: branching-strategies
description: "Choosing and operating a Git branching model: trunk-based development, GitHub flow, release branches, and when GitFlow is justified; branch naming, protection rules and rulesets, required reviews and status checks, merge strategies (squash, rebase, merge commits, merge queues), hotfix flows, and backporting. Use it when defining or reviewing how a team branches, merges, and releases on GitHub, GitLab, or Azure DevOps."
---

# Skill: Branching Strategies

## Implementation Rules:
- **[ARCHITECTURE]** Default to trunk-based development or GitHub flow (short-lived feature branches merged into `main` behind green CI) for continuously deployed services; add release branches (`release/2.4`) only when multiple versions must be supported in parallel (mobile apps, on-premises products, libraries with LTS lines).
- **[FORBIDDEN]** GitFlow's long-lived `develop` branch and long-running feature branches for teams practicing continuous delivery, environment branches (`dev`, `staging`, `prod`) used to promote code, and direct pushes to `main`.
- **[MANDATORY]** Protect the default and release branches with rulesets or branch protection: pull request required, at least one approving review from someone other than the author, CODEOWNERS review for owned paths, required status checks, up-to-date or merge-queue validation, signed commits where policy requires, and no force pushes or deletions.
- **[PATTERN]** Keep branches short-lived (hours to a couple of days), small in scope, and named consistently (`feat/<ticket>-<slug>`, `fix/<ticket>-<slug>`, `release/<major.minor>`, `hotfix/<version>`).
- **[PATTERN]** Choose one merge strategy per repository and enforce it: squash merges with a Conventional Commit title for linear, readable history; rebase merges when individual commits are meaningful; merge commits only when preserving branch topology matters.
- **[PATTERN]** Use a merge queue (GitHub merge queue, GitLab merge trains, Azure DevOps with build validation) on busy repositories so every merged commit has been tested against the latest `main`.
- **[PATTERN]** Hotfixes start from the release tag or release branch, are merged back (or cherry-picked forward) to `main` immediately, and follow the same review and CI rules with an expedited path, never a bypass.
- **[PATTERN]** Backport fixes to supported release branches with automated cherry-pick tooling (backport bots or labels), keeping a record of which versions contain each fix.
- **[MANDATORY]** Tags mark releases (`v2.4.1`), are created by the release process from a commit that passed CI, and are protected against deletion and moving.
- **[SECURITY]** Restrict who can modify branch rules, workflows, and CODEOWNERS; require reviews for changes to CI configuration and deployment definitions.
- **[TESTING]** Measure the model's health: branch age, pull request size and time to merge, number of merge conflicts, and main-branch build success rate; long-lived branches and red builds on `main` are treated as defects in the process.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
