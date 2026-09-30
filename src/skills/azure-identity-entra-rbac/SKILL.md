---
name: azure-identity-entra-rbac
description: "Identity and access on Azure with Microsoft Entra ID: Azure RBAC with built-in and custom roles at the right scope, groups instead of users, Privileged Identity Management for just-in-time roles, Conditional Access and phishing-resistant MFA, managed identities and workload identity federation, app registrations and consent, Key Vault RBAC, emergency access accounts, and access reviews. Use it when designing or reviewing Azure identity and permissions."
---

# Skill: Azure Identity (Entra ID and RBAC)

## Implementation Rules:
- **[MANDATORY]** Assign Azure RBAC roles to Entra ID groups at the narrowest scope that works (resource, resource group, subscription, management group), never to individual users, and prefer data-plane roles (for example `Storage Blob Data Reader`, `Key Vault Secrets User`) over broad control-plane roles.
- **[MANDATORY]** Use Privileged Identity Management for privileged roles (Owner, User Access Administrator, Contributor on production, Entra administrative roles): eligible instead of permanent assignments, activation with MFA, justification, approval for the most sensitive roles, and time-limited durations.
- **[MANDATORY]** Protect sign-ins with Conditional Access: phishing-resistant MFA (FIDO2 security keys, passkeys, Windows Hello for Business) for administrators, MFA for all users, blocking legacy authentication, and device compliance or trusted locations for sensitive applications.
- **[MANDATORY]** Workloads authenticate with managed identities (system- or user-assigned) or workload identity federation (AKS, GitHub Actions, other OIDC issuers) instead of client secrets or certificates; remaining app registration credentials are short-lived certificates stored in Key Vault with owners and expiry alerts.
- **[PATTERN]** Create custom roles only when built-in roles are too broad, with explicit `Actions`/`DataActions` and assignable scopes, reviewed like code.
- **[SECURITY]** Govern applications: restrict user consent to verified publishers and low-risk permissions, review admin-consented permissions, remove unused app registrations and service principals, and monitor for credential additions.
- **[PATTERN]** Maintain at least two cloud-only emergency access (break-glass) accounts excluded from Conditional Access lockout policies, protected with FIDO2 keys, monitored with alerts on every sign-in, and tested periodically.
- **[FORBIDDEN]** Owner or Contributor at management group or subscription scope for day-to-day work, shared accounts, client secrets for Azure-hosted workloads that support managed identity, and Key Vault access policies for new vaults (use Azure RBAC for Key Vault).
- **[PATTERN]** Automate the identity lifecycle: HR-driven provisioning, group-based access packages in entitlement management for requests and approvals, and access reviews for privileged roles and guest users on a recurring schedule.
- **[PATTERN]** Manage role assignments, custom roles, and Conditional Access policies as code (Terraform `azurerm` and `azuread` providers or Bicep/Microsoft Graph), with changes reviewed and exported for audit.
- **[TESTING]** Monitor and verify: Entra sign-in and audit logs in the central workspace, alerts on privileged role activations outside PIM and on new owner assignments, Conditional Access What If evaluations before rollout, and report-only mode for new policies.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
