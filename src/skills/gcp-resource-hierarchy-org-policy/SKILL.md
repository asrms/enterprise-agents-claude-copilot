---
name: gcp-resource-hierarchy-org-policy
description: "Google Cloud foundation design: organization, folders, and projects as the resource hierarchy, project factory and naming, organization policy constraints as guardrails (including custom constraints), centralized logging with aggregated sinks, Security Command Center, billing account structure and labels, shared VPC host projects, and foundation deployment with Terraform (enterprise foundations blueprint). Use it when designing or reviewing a Google Cloud landing zone."
---

# Skill: Google Cloud Resource Hierarchy and Organization Policy

## Implementation Rules:
- **[ARCHITECTURE]** Design the hierarchy for policy inheritance and isolation: organization, top-level folders by environment or business unit (for example `bootstrap`, `common`, `production`, `non-production`, `development`), and one project per workload and environment; projects are the unit of isolation, quota, and billing attribution.
- **[MANDATORY]** Create projects only through an automated project factory (Terraform modules or the enterprise foundations blueprint) that sets naming, labels, billing, enabled APIs, networking attachment, IAM groups, budgets, and logging.
- **[MANDATORY]** Apply organization policy guardrails at organization or folder level, for example: `iam.disableServiceAccountKeyCreation`, `iam.allowedPolicyMemberDomains` (domain-restricted sharing), `compute.vmExternalIpAccess`, `storage.publicAccessPrevention`, `storage.uniformBucketLevelAccess`, `sql.restrictPublicIp`, `gcp.resourceLocations`, and `compute.requireOsLogin`; use custom constraints for organization-specific rules.
- **[MANDATORY]** Centralize logs with aggregated sinks at the organization level (audit logs, including Data Access logs for sensitive services, and important platform logs) to a dedicated logging project with locked retention buckets and restricted access.
- **[SECURITY]** Activate Security Command Center at the organization level, route high-severity findings to security operations, and track posture across projects.
- **[PATTERN]** Grant IAM on folders and projects to Google groups mapped to job functions, keep organization-level roles to a minimum (Organization Administrator held by few, with break-glass accounts), and manage all bindings as code.
- **[PATTERN]** Use Shared VPC host projects per environment in the common folder with service projects attached, so networking is centrally governed while teams own their workloads.
- **[PATTERN]** Structure billing: billing accounts linked through the factory, required labels (`cost-center`, `owner`, `env`, `app`) on projects and resources, budgets per project, and billing export to BigQuery.
- **[FORBIDDEN]** Projects created manually in the console, resources directly under the organization node, basic roles (Owner/Editor/Viewer) granted to users for workloads, and exceptions to organization policies applied without documentation.
- **[PATTERN]** Handle exceptions by overriding a constraint on a specific folder or project with a documented reason and review date (tags with conditional organization policies where supported), not by relaxing it at the organization level.
- **[TESTING]** Use the organization policy dry-run mode and Policy Simulator before enforcing new constraints, and verify guardrails with automated checks (for example, attempting to create a public bucket in a test project must fail).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
