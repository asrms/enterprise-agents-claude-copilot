# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One subscription, manual governance
```text
Tenant Root Group
└── Subscription "Company-Azure" (all environments and teams)
    ├── rg-prod-app1, rg-test-app1, rg-dev-everything
    ├── 23 users with Owner at subscription scope
    └── no policies; diagnostic settings configured by some teams, retention unknown
```
**Why it's wrong:**
- No isolation between environments or teams, and one compromised Owner account controls everything.
- Guardrails and logging depend on individual discipline, so security and compliance cannot be demonstrated.

## Best Practice (How to do it right)

### 1. Management group hierarchy
```text
Tenant Root Group
└── contoso (intermediate root)
    ├── platform
    │   ├── management      -> sub-mgmt (Log Analytics, Automation, Sentinel)
    │   ├── connectivity    -> sub-conn (hub VNets or Virtual WAN, Firewall, DNS)
    │   └── identity        -> sub-identity
    ├── landingzones
    │   ├── corp            -> sub-claims-prod, sub-claims-nonprod
    │   └── online          -> sub-webshop-prod, sub-webshop-nonprod
    ├── sandbox
    └── decommissioned
```
### 2. Policy assignment at management group scope (Terraform)
```hcl
resource "azurerm_management_group_policy_assignment" "allowed_locations" {
  name                 = "allowed-locations"
  management_group_id  = azurerm_management_group.landingzones.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c"
  parameters = jsonencode({
    listOfAllowedLocations = { value = ["westeurope", "northeurope"] }
  })
}

resource "azurerm_management_group_policy_assignment" "deny_storage_public_access" {
  name                 = "deny-storage-public"
  management_group_id  = azurerm_management_group.corp.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/b2982f36-99f2-4db5-8eff-283140c09693"
  parameters = jsonencode({ effect = { value = "Deny" } })
}
```
**Why it's right:**
- Platform and application responsibilities are separated into management groups and subscriptions per workload and environment.
- Guardrails are inherited by every subscription under the scope and defined as code, so new subscriptions are compliant from creation.
