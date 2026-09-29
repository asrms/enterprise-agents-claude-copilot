---
name: azure-pipelines-agents
description: "Running Azure Pipelines agents: Microsoft-hosted agents and image selection, Managed DevOps Pools, VM scale set agents, self-hosted agents in containers or Kubernetes, agent pools and queues, demands and capabilities, ephemeral one-job agents, network isolation and private endpoints, agent identity and least privilege, agent upgrades and image maintenance, parallel job capacity, and cost control. Use it when choosing, setting up, scaling, securing, or troubleshooting Azure DevOps build agents."
---

# Skill: Azure Pipelines Agents

## Implementation Rules:
- **[ARCHITECTURE]** Prefer Microsoft-hosted agents for standard builds; use Managed DevOps Pools (or VM scale set agents) when you need larger VMs, private network access, custom images, or warm caches, and self-hosted agents only for requirements neither can meet.
- **[MANDATORY]** Pin hosted images explicitly (`ubuntu-24.04`, `windows-2025`) in YAML, track image deprecation announcements, and test pipelines against new images before the `-latest` labels move.
- **[SECURITY]** Make self-managed agents ephemeral: one job per agent instance (Managed DevOps Pools stateless agents, scale set agents with recycle after each use, or containers started with `--once`), so no state or credentials leak between jobs.
- **[SECURITY]** Separate agent pools by trust level: pools for pull request validation (including forks) with no internal network access, pools for regular builds, and protected pools for production deployments with approvals and checks on the pool.
- **[SECURITY]** Register agents with short-lived credentials (service principal or managed identity authentication for Managed DevOps Pools and scale sets, or a PAT scoped only to Agent Pools (read, manage) that is discarded after registration), run agent services as non-administrator accounts, and never store deployment credentials on agents.
- **[PATTERN]** Use demands and capabilities sparingly and explicitly (`demands: [docker, Agent.OS -equals Linux]`), and prefer separate pools over complex demand matching for fundamentally different machines such as GPU or macOS signing agents.
- **[CONFIGURATION]** Build custom agent images as code (Packer or the runner-images templates, or Dockerfiles for container agents) with pinned tool versions, patched regularly on a schedule, and published to Azure Compute Gallery or a private registry.
- **[CONFIGURATION]** Place self-managed agents in a dedicated virtual network or subnet with private endpoints to Azure resources, egress restricted to required endpoints (Azure DevOps URLs, package feeds, registries), and no inbound connectivity.
- **[PERFORMANCE]** Size pools from queue metrics: configure standby agents during working hours, scale to zero overnight, choose VM SKUs per workload, and buy parallel jobs based on measured queue time rather than guesses.
- **[FORBIDDEN]** Long-lived shared self-hosted agents running untrusted pull request code, agents running as root or local administrator with Docker socket access for every job, agents with Owner or Contributor identities, and outdated agent versions pinned indefinitely.
- **[PATTERN]** Keep the agent software updated automatically (the default for agent pools) and monitor agent health: offline agents, job failures by agent, disk space, and queue time per pool.
- **[TESTING]** Validate new agent images with a canary pool running representative pipelines before switching production pools, and periodically verify that jobs on PR pools cannot reach internal resources or secrets.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
