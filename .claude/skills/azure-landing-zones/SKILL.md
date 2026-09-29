---
name: azure-landing-zones
description: "Azure landing zone design following the Cloud Adoption Framework: management group hierarchy, platform and application landing zone subscriptions, subscription vending, Azure Policy and initiatives for guardrails, centralized logging with Log Analytics, Microsoft Defender for Cloud, identity and connectivity subscriptions, and deployment with Azure Verified Modules in Bicep or Terraform. Use it when designing or reviewing the foundation of an Azure environment."
---

# Skill: Azure Landing Zones

## Implementation Rules:
- **[ARCHITECTURE]** Follow the Azure landing zone conceptual architecture: a management group hierarchy under the tenant root with `Platform` (management, connectivity, identity) and `Landing Zones` (for example `Corp` for internally connected and `Online` for internet-facing workloads), plus `Sandbox` and `Decommissioned` groups.
- **[MANDATORY]** Use subscriptions as the unit of isolation and scale: separate subscriptions per workload and environment, created through an automated subscription vending process that applies naming, tags, budgets, networking, RBAC, and policy assignments.
- **[MANDATORY]** Enforce guardrails with Azure Policy assigned at management group scope: allowed regions, required tags, deny public IPs or public network access where required, enforce diagnostic settings to the central workspace, require encryption and TLS minimums, and deploy Defender plans; use `deny` and `deployIfNotExists` effects deliberately and audit first when rolling out.
- **[MANDATORY]** Centralize logging: Activity Logs, Entra ID sign-in and audit logs, resource diagnostics, and Defender alerts flow to a Log Analytics workspace (and Microsoft Sentinel where used) in the management subscription, with retention matching compliance needs.
- **[SECURITY]** Enable Microsoft Defender for Cloud across all subscriptions with the relevant plans, track secure score and regulatory compliance, and route high-severity alerts to the security operations process.
- **[PATTERN]** Separate platform responsibilities: the platform team owns the management groups, policies, connectivity hub, and shared services; application teams own their landing zone subscriptions with delegated RBAC within the guardrails.
- **[PATTERN]** Deploy the platform as code with Azure Verified Modules (AVM) or the Azure landing zones accelerator for Bicep or Terraform, with pipelines using workload identity federation, pull request reviews, and what-if or plan outputs.
- **[FORBIDDEN]** All workloads in one subscription, Owner role granted broadly at management group scope, policies assigned per resource group by hand, and diagnostic settings left to each team's discretion.
- **[PATTERN]** Manage exceptions with policy exemptions that carry a category (waiver or mitigated), justification, and expiry date, reviewed regularly.
- **[PATTERN]** Plan identity and connectivity foundations up front: Entra ID tenant strategy, PIM for privileged roles, hub-and-spoke or Virtual WAN topology, and IP address management across regions.
- **[TESTING]** Test policies in a non-production management group before assignment to production scopes, monitor policy compliance dashboards, and verify vending by creating and decommissioning a test subscription through the pipeline.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
