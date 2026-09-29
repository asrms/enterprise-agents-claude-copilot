# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Permanent broad roles and secrets for workloads
```text
- 18 users with permanent Owner on the production subscription
- App Service reads Key Vault with a client secret stored in App Settings (expires 2099)
- Key Vault uses access policies granting "all" secret permissions to a developer group
- No Conditional Access; legacy authentication allowed; no break-glass accounts
```
**Why it's wrong:**
- Standing privileged access and long-lived secrets create a large, persistent attack surface.
- Without Conditional Access and emergency accounts, the tenant is both easy to attack and easy to lock out.

## Best Practice (How to do it right)

### 1. Managed identity with data-plane RBAC on Key Vault and Storage (Terraform)
```hcl
resource "azurerm_user_assigned_identity" "claims_api" {
  name                = "id-claims-api-prod"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
}

resource "azurerm_key_vault" "claims" {
  name                       = "kv-claims-prod-weu"
  location                   = var.location
  resource_group_name        = azurerm_resource_group.app.name
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = true
  public_network_access_enabled = false
}

resource "azurerm_role_assignment" "claims_api_secrets" {
  scope                = azurerm_key_vault.claims.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.claims_api.principal_id
}

resource "azurerm_role_assignment" "claims_api_blobs" {
  scope                = azurerm_storage_container.documents.resource_manager_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.claims_api.principal_id
}
```
### 2. Conditional Access for administrators (report-only first, azuread provider)
```hcl
resource "azuread_conditional_access_policy" "admins_phishing_resistant_mfa" {
  display_name = "CA01 - Admins require phishing-resistant MFA"
  state        = "enabledForReportingButNotEnforced"
  conditions {
    client_app_types = ["all"]
    applications { included_applications = ["All"] }
    users {
      included_roles = [var.role_template_ids["Global Administrator"], var.role_template_ids["Privileged Role Administrator"]]
      excluded_users = var.break_glass_account_ids
    }
  }
  grant_controls {
    operator                          = "OR"
    authentication_strength_policy_id = var.phishing_resistant_strength_id
  }
}
```
**Why it's right:**
- The workload uses a managed identity with data-plane roles scoped to one vault and one container; no secrets exist to leak.
- The vault uses RBAC, purge protection, and private access; privileged users face phishing-resistant MFA, rolled out in report-only mode first with break-glass accounts excluded.
