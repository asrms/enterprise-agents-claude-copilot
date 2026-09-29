---
name: azure-pipelines-environments
description: "Deploying with Azure Pipelines environments and deployment jobs: environments with Kubernetes and virtual machine resources, deployment strategies (runOnce, rolling, canary) and lifecycle hooks, approvals and checks per environment, promotion of one artifact through stages, deployment slots and blue-green releases for App Service, rollbacks, deployment history and traceability to work items, and database migrations during releases. Use it when designing or reviewing release flows in Azure DevOps."
---

# Skill: Azure Pipelines Environments and Deployments

## Implementation Rules:
- **[MANDATORY]** Deploy only from `deployment` jobs that target a named `environment` (for example `shop-staging`, `shop-production`), so Azure DevOps records deployment history, commits, and work items per environment and applies its checks.
- **[ARCHITECTURE]** Build once and promote: every environment deploys the same pipeline artifact or image digest produced by the build stage; environment differences come from configuration, never from rebuilding.
- **[SECURITY]** Configure checks on each protected environment: approvals from a named group (with "requester cannot approve" for production), branch control limited to `refs/heads/main` or release tags, business hours, Azure Monitor alerts or REST/Azure Function gates, and exclusive lock to serialize deployments.
- **[PATTERN]** Choose a deployment strategy per target: `runOnce` for simple deployments, `rolling` for virtual machine resources with `maxParallel`, and `canary` with increments for Kubernetes, using lifecycle hooks (`preDeploy`, `deploy`, `routeTraffic`, `postRouteTraffic`, `on: failure`, `on: success`).
- **[PATTERN]** For Azure App Service use deployment slots: deploy to a staging slot, warm up and smoke test it, then swap to production, keeping the previous version in the slot for instant rollback.
- **[PATTERN]** Put verification in `postRouteTraffic` (smoke tests, synthetic checks, metric queries) and rollback logic in `on: failure`, so a failed canary or health check automatically reverts or stops the rollout.
- **[MANDATORY]** Make database migrations backward compatible (expand and contract), run them as a dedicated, idempotent step before switching traffic, and never combine a destructive schema change with the code release that stops using it.
- **[CONFIGURATION]** Use environment-scoped variable groups and parameters for settings per environment, keep environment names consistent across services, and add Kubernetes or VM resources to environments for per-resource deployment visibility.
- **[FORBIDDEN]** Deploying from regular jobs without environments, approvals only in YAML comments, rebuilding artifacts for production, manual portal changes to production outside the pipeline, and releases without a tested rollback path.
- **[PATTERN]** Support scheduled and manual releases explicitly: production stages gated by approvals, deployment freeze windows via business-hours checks or an Azure Function gate, and hotfix pipelines that follow the same checks.
- **[CONFIGURATION]** Link deployments to work items and releases: reference work items in commits and pull requests (for example `AB#1234` for GitHub repositories or linked work items in Azure Repos) so environment history shows what shipped, and tag releases in the repository.
- **[TESTING]** Rehearse deployments and rollbacks in staging with production-like data volume, verify each stage with automated smoke tests, and review deployment frequency, lead time, and failure rate from environment history.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
