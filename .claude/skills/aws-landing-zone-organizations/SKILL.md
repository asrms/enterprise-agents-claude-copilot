---
name: aws-landing-zone-organizations
description: "Multi-account AWS landing zones with AWS Organizations and Control Tower: OU structure, account vending with Account Factory for Terraform, service control policies, resource control policies, IAM Identity Center permission sets, delegated administrators, and centralized logging and security accounts. Use it when designing or changing an AWS organization, its accounts, or its guardrails."
---

# Skill: AWS Landing Zone and Organizations

## Implementation Rules:
- **[ARCHITECTURE]** Use one account per workload per environment as the isolation boundary; group accounts in OUs by control requirements (Security, Infrastructure, Workloads/Prod, Workloads/NonProd, Sandbox, Suspended, Policy Staging), not by org chart, and keep OU nesting shallow.
- **[MANDATORY]** Keep the management account empty of workloads: it holds only Organizations, billing, and Control Tower; security tooling runs in a dedicated Audit/Security Tooling account and logs in a Log Archive account through delegated administrators (GuardDuty, Security Hub, Config, IAM Access Analyzer, Firewall Manager).
- **[PATTERN]** Govern the landing zone with AWS Control Tower (or an equivalent IaC baseline) and vend accounts through code, for example Account Factory for Terraform (AFT), so every new account gets the same baseline: CloudTrail, Config, GuardDuty, Security Hub, budgets, and a default-deny network posture.
- **[SECURITY]** Apply service control policies at OU level as guardrails: deny leaving the organization, deny disabling CloudTrail, Config, GuardDuty, and Security Hub, deny unapproved Regions with exemptions for global services, and deny root user actions in member accounts; SCPs never grant permissions.
- **[SECURITY]** Use resource control policies for data perimeters on supported services (S3, STS, KMS, SQS, Secrets Manager), for example denying access from principals outside the organization with `aws:PrincipalOrgID`, with exceptions for AWS service principals.
- **[SECURITY]** Human access uses IAM Identity Center with an external identity provider, groups, and permission sets scoped per OU or account; no IAM users for people, and centralized root access management removes root credentials from member accounts.
- **[PATTERN]** Send an organization CloudTrail trail and AWS Config aggregator data to the Log Archive account into S3 buckets with Object Lock, KMS encryption, and restrictive bucket policies; security findings aggregate in the delegated Security Hub administrator.
- **[PATTERN]** Enable tag policies and backup policies in AWS Organizations for mandatory cost and ownership tags and baseline backup plans; declarative policies can enforce service-level settings such as blocking public AMI sharing.
- **[FORBIDDEN]** Workloads or CI roles in the management account, a single shared production account for many teams, SCPs attached directly to accounts as one-off exceptions, and editing guardrails in the console instead of code.
- **[TESTING]** Stage every SCP or RCP in a Policy Staging OU with a test account first, validate policy JSON with IAM Access Analyzer, and prove both that denied actions fail and that deployment pipelines still succeed before attaching the policy to production OUs.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
