---
name: gitlab-environments-deployments
description: "Deploying with GitLab environments: static and dynamic environments, review apps with on_stop and auto_stop_in, protected environments with deployment approvals, resource groups and process modes, promotion of one immutable artifact across environments, manual and scheduled releases, rollbacks and re-deploys, GitLab releases from tags, deployment tiers, and GitOps with the GitLab agent for Kubernetes and Flux. Use it when designing or reviewing deployment flows in GitLab."
---

# Skill: GitLab Environments and Deployments

## Implementation Rules:
- **[MANDATORY]** Every job that deploys declares `environment:name` (and `url` where applicable) with a `deployment_tier` so GitLab tracks deployment history, the running version per environment, and rollback targets.
- **[ARCHITECTURE]** Build once and promote: produce one immutable artifact (image digest or package version) per commit and deploy that same artifact to staging and production; never rebuild per environment.
- **[SECURITY]** Protect staging and production environments, require deployment approvals from a named group for production, and restrict who can deploy; combine with protected tags or the protected default branch as the only allowed sources.
- **[PATTERN]** Create review apps as dynamic environments (`review/$CI_COMMIT_REF_SLUG`) with `on_stop` jobs and `auto_stop_in`, so every merge request gets an isolated, automatically cleaned-up environment.
- **[CONFIGURATION]** Serialize deployments per environment with `resource_group` (and `process_mode: newest_first` or `oldest_first` as appropriate) and mark deploy jobs non-interruptible so concurrent pipelines never deploy over each other.
- **[PATTERN]** Separate deployment stages explicitly: automatic deploy to staging after tests, then a manual or approval-gated production job (`when: manual` with `allow_failure: false`), or deploy freezes (`CI_DEPLOY_FREEZE`) during change-freeze windows.
- **[PATTERN]** Support rollback as a first-class action: re-deploy a previous successful deployment from the environment page or with an explicit rollback job using a known artifact version, and keep database migrations backward compatible (expand and contract).
- **[PATTERN]** Create GitLab releases from semantic version tags with the `release` keyword or `glab release`, including notes generated from the changelog and links to artifacts and images.
- **[ARCHITECTURE]** For Kubernetes, prefer GitOps with the GitLab agent for Kubernetes and Flux (pipeline updates a manifest or image tag in a config repository) over pipelines holding cluster-admin kubeconfigs, and use the agent's authorization scoped to specific projects and namespaces.
- **[FORBIDDEN]** Deploy jobs without `environment`, rebuilding images for production, kubeconfigs with cluster-admin rights stored as variables, deploying from feature branches to shared environments, and review apps that are never stopped.
- **[TESTING]** Verify each deployment with smoke tests and health checks in a post-deploy job against the environment URL, fail the pipeline on errors, and trigger an automated rollback or stop progressive rollout when checks fail.
- **[CONFIGURATION]** Use environment-scoped CI/CD variables for configuration that differs per environment, and keep environment names consistent across projects to enable dashboards and DORA metrics (deployment frequency, lead time, change failure rate).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
