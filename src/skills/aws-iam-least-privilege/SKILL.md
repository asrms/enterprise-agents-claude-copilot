---
name: aws-iam-least-privilege
description: "Least-privilege AWS IAM: roles instead of users, IAM Identity Center for people, scoped identity and resource policies with condition keys, permission boundaries, ABAC with tags, confused deputy protection, EKS Pod Identity, and IAM Access Analyzer validation, policy checks, and unused access findings. Use it when writing or reviewing IAM policies, roles, or trust relationships."
---

# Skill: AWS IAM Least Privilege

## Implementation Rules:
- **[MANDATORY]** Workloads use IAM roles with temporary credentials (instance profiles, Lambda execution roles, ECS task roles, EKS Pod Identity or IRSA, IAM Roles Anywhere for on-premises); people use IAM Identity Center permission sets; IAM users with access keys are not created.
- **[MANDATORY]** One role per workload and purpose, with actions and resources named explicitly (table ARN, bucket prefix, queue ARN, KMS key ARN); read and write access are separate statements, and write actions never use `"Resource": "*"`.
- **[FORBIDDEN]** `"Action": "*"`, service-wide wildcards such as `s3:*` or `dynamodb:*` on workload roles, `AdministratorAccess` or `PowerUserAccess` attached to applications or pipelines, and `iam:PassRole` on `*` without an `iam:PassedToService` condition.
- **[SECURITY]** Scope with condition keys: `aws:PrincipalOrgID` or `aws:ResourceOrgID` for data perimeters, `aws:SourceArn` and `aws:SourceAccount` on service-principal trust and resource policies to prevent the confused deputy problem, `aws:SecureTransport` for TLS, and `aws:SourceVpce` for endpoint-only access.
- **[SECURITY]** Trust policies name exact principals (account role ARNs, service principals, OIDC providers with `sub` and `aud` conditions) and require `sts:ExternalId` for third-party cross-account roles; never trust a whole account root when a specific role is meant.
- **[PATTERN]** Delegate role creation to teams with permission boundaries: the pipeline may create roles only when `iam:PermissionsBoundary` equals the approved boundary, so delegated roles cannot exceed it.
- **[PATTERN]** Use attribute-based access control where resources are numerous: tag principals and resources (`project`, `environment`) and match `aws:PrincipalTag/project` with `aws:ResourceTag/project`, while protecting the tags themselves from modification.
- **[PATTERN]** Build policies with `aws_iam_policy_document` data sources in Terraform, not string templates, and generate a starting policy from CloudTrail activity with IAM Access Analyzer policy generation when refining an over-broad role.
- **[SECURITY]** Enable IAM Access Analyzer external access and unused access analyzers at the organization level, remove unused roles, permissions, and keys found by them, and alert on root user activity and on `CreateAccessKey` events.
- **[TESTING]** Run `aws accessanalyzer validate-policy` and custom policy checks (`check-no-new-access`, `check-access-not-granted`, `check-no-public-access`) in CI for every policy change, and test that forbidden actions are denied with the IAM policy simulator or an integration test.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
