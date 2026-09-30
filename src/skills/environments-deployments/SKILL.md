---
name: environments-deployments
description: "Deployment workflows with GitHub Actions environments: promotion from dev to staging to production, protection rules and required reviewers, environment-scoped secrets and variables, deployment branches and tags, concurrency for deployments, progressive delivery, smoke tests, and automated rollback. Use it when designing or reviewing CD pipelines on GitHub."
---

# Skill: Environments and Deployments

## Implementation Rules:
- **[ARCHITECTURE]** Model each target as a GitHub environment (`development`, `staging`, `production`) and promote the same immutable artifact (image digest or versioned package) through them; never rebuild per environment.
- **[MANDATORY]** Protect production environments: required reviewers (not the author), wait timers where useful, deployment branch/tag rules (only `main` or `v*` tags), and custom deployment protection rules (change management, monitoring gates) where required.
- **[MANDATORY]** Secrets and variables are scoped to environments (`environment: production` gives access to production secrets only), and cloud access uses OIDC with trust policies restricted to the environment claim (`repo:org/app:environment:production`).
- **[PATTERN]** Use `concurrency` per environment (`group: deploy-production`, `cancel-in-progress: false`) so deployments to the same environment are serialized and never cancelled halfway.
- **[PATTERN]** Deployments are declarative and idempotent (Helm, Kustomize with GitOps, Terraform, platform CLIs with desired-state configuration); the workflow records the deployed version and sets `environment.url` for traceability.
- **[PATTERN]** Progressive delivery for user-facing services: canary or blue-green releases with automated analysis of error rate and latency (Argo Rollouts, Flagger, cloud-native traffic shifting), and feature flags to decouple deployment from release.
- **[MANDATORY]** Every deployment runs post-deployment smoke tests against the environment and fails the job, triggering rollback or halting promotion, when they fail.
- **[PATTERN]** Rollback is a first-class, rehearsed path: redeploy the previous known-good artifact via the same workflow (`workflow_dispatch` with a version input), and database migrations are backward compatible so application rollback is safe.
- **[FORBIDDEN]** Deploying directly from pull request branches to shared environments, manual changes in production outside the pipeline, `latest` tags as deployment references, and production credentials available to jobs without an environment.
- **[PATTERN]** Separate build (CI) and deploy (CD) workflows connected by artifacts, releases, or `workflow_run`/repository dispatch with explicit inputs; for Kubernetes, prefer GitOps where the workflow updates the desired state repository and a controller applies it.
- **[TESTING]** Track deployment frequency, lead time, change failure rate, and time to restore (DORA metrics) from deployment records, and review failed deployments in blameless post-incident reviews.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
