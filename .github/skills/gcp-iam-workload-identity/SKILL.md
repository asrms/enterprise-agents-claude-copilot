---
name: gcp-iam-workload-identity
description: "Identity and access management on Google Cloud: predefined and custom roles instead of basic roles, Google groups, service accounts per workload without keys, Workload Identity Federation for CI/CD and other clouds, Workload Identity Federation for GKE, service account impersonation for administrators, IAM Conditions, deny policies, Privileged Access Manager, recommenders, and audit logging. Use it when designing or reviewing IAM on Google Cloud."
---

# Skill: Google Cloud IAM and Workload Identity

## Implementation Rules:
- **[MANDATORY]** Grant predefined roles (or narrow custom roles) to Google groups at the lowest practical level of the hierarchy; never grant basic roles (Owner, Editor, Viewer) to users or workloads in production.
- **[MANDATORY]** Give each workload its own dedicated service account with only the roles it needs on specific resources (bucket, dataset, topic, secret), not project-wide roles; do not use default compute or App Engine service accounts, and disable automatic grants to them.
- **[MANDATORY]** Do not create service account keys (enforce `iam.disableServiceAccountKeyCreation`): CI/CD systems and other clouds authenticate through Workload Identity Federation pools and providers with attribute conditions, and GKE workloads use Workload Identity Federation for GKE.
- **[PATTERN]** Administrators and developers use service account impersonation (`roles/iam.serviceAccountTokenCreator` on specific service accounts) for automation tasks instead of downloading keys, and just-in-time elevation with Privileged Access Manager for sensitive roles.
- **[PATTERN]** Use IAM Conditions to scope grants by resource name prefix, resource tags, or time (for example temporary access that expires), and IAM deny policies to block high-risk permissions regardless of allow grants.
- **[SECURITY]** Restrict federation precisely: workload identity pool providers accept tokens only from the expected issuer, with attribute conditions on repository, branch or environment claims, and service account impersonation bound to specific principal sets.
- **[PATTERN]** Right-size continuously with the IAM recommender (role recommendations based on usage), and remove unused service accounts and bindings; review privileged bindings in access reviews.
- **[FORBIDDEN]** Service account keys stored in repositories or CI variables, `allUsers` or `allAuthenticatedUsers` bindings on non-public resources, granting `roles/iam.serviceAccountUser` or `TokenCreator` project-wide, and sharing one service account across unrelated workloads.
- **[MANDATORY]** Enable and centralize audit logs (Admin Activity by default, Data Access logs for sensitive services), and alert on IAM policy changes, service account key creation attempts, and role grants to external identities.
- **[PATTERN]** Manage IAM bindings as code with authoritative or additive Terraform resources chosen deliberately (`google_project_iam_member` for additive, `_binding`/`_policy` only with care), reviewed in pull requests with policy checks.
- **[TESTING]** Use Policy Troubleshooter and Policy Analyzer to verify who can access sensitive resources, test federation conditions with negative cases (a workflow from another repository must fail), and run periodic reports of basic role usage.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
