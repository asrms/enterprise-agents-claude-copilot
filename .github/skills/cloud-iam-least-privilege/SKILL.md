---
name: cloud-iam-least-privilege
description: "Least-privilege identity and access management across AWS, Azure, and Google Cloud: role design for humans and workloads, groups and federation instead of users, temporary credentials, permission boundaries and organization guardrails, conditions and resource scoping, access analyzers and unused-permission cleanup, privileged access management, and access reviews. Use it when designing or reviewing cloud IAM in any provider."
---

# Skill: Cloud IAM Least Privilege

## Implementation Rules:
- **[MANDATORY]** Humans access cloud accounts through federation from the central identity provider (AWS IAM Identity Center, Entra ID, Cloud Identity/Workforce Identity Federation) with MFA; no long-lived IAM users, access keys, or service account keys for people.
- **[MANDATORY]** Workloads use platform identities with temporary credentials (IAM roles, EKS Pod Identity or IRSA, Azure managed identities and workload identity, GCP service accounts with workload identity federation); static keys exist only for documented exceptions with rotation.
- **[PATTERN]** Grant permissions to groups or roles mapped to job functions, never to individuals directly, and separate read-only, operator, and administrator roles per environment; production access is narrower than non-production.
- **[MANDATORY]** Scope policies to specific actions and resources (ARNs, resource IDs, scopes at resource-group or project level) with conditions (source VPC or network, tags, organization id, MFA age); avoid wildcards for write actions and provider-managed broad roles such as Owner/Contributor/Editor for workloads.
- **[ARCHITECTURE]** Apply organization-level guardrails that no account administrator can override: AWS SCPs and RCPs, Azure Policy with management groups, GCP organization policies and IAM deny policies (for example, deny disabling logging, deny public buckets, restrict regions).
- **[PATTERN]** Use permission boundaries or delegated role creation constraints so teams can create roles for their workloads without escalating beyond an approved ceiling.
- **[SECURITY]** Privileged access is just-in-time and approved (Entra Privileged Identity Management, AWS temporary elevated access, GCP Privileged Access Manager), time-limited, and audited; break-glass accounts are few, monitored, and tested.
- **[PATTERN]** Right-size continuously with analyzers: AWS IAM Access Analyzer (unused access, policy generation from CloudTrail), Azure and Entra access reviews, GCP IAM Recommender; remove unused roles and permissions on a schedule.
- **[FORBIDDEN]** `"Action": "*"` with `"Resource": "*"` for applications, cross-account trust to entire accounts without conditions (external id, organization id, specific principals), primitive roles on production projects, and sharing credentials between services.
- **[MANDATORY]** Define IAM as code (Terraform, OpenTofu, Bicep, or Pulumi) reviewed in pull requests, with policy checks (Checkov, policy-as-code rules) that flag wildcards and privilege escalation paths.
- **[PATTERN]** Detect privilege escalation paths (for example `iam:PassRole` with broad resources, permission to modify own policies, service account impersonation chains) with tooling such as PMapper, Cloudsplaining, or provider analyzers, and remove them.
- **[TESTING]** Periodically verify: access reviews of privileged roles quarterly, simulations of policies (`aws iam simulate-principal-policy`, Policy Troubleshooter), and alerts on IAM changes, new admin grants, and key creation.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
