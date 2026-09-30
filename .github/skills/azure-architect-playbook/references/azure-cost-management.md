# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. No ownership, no alerts, always-on non-production
```text
Cost reviewed quarterly by finance from the invoice PDF
35% of spend in resource groups without tags
Dev and test VMs (D8s_v5) running 24/7; Log Analytics ingesting debug logs at 400 GB/day with 2-year retention
A 3-year reservation bought for a VM size the team migrated away from
```
**Why it's wrong:**
- Nobody sees or owns costs in time to react, and idle or low-value resources run continuously.
- Commitments are misaligned with actual usage, wasting the discount.

## Best Practice (How to do it right)

### 1. Tag inheritance policy and budget with alerts (Terraform)
```hcl
resource "azurerm_subscription_policy_assignment" "inherit_cost_center" {
  name                 = "inherit-costcenter-from-rg"
  subscription_id      = data.azurerm_subscription.current.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/cd3aa116-8754-49c9-a813-ad46512ece54"
  location             = var.location
  identity { type = "SystemAssigned" }
  parameters = jsonencode({ tagName = { value = "costCenter" } })
}

resource "azurerm_consumption_budget_subscription" "claims_prod" {
  name            = "budget-claims-prod"
  subscription_id = data.azurerm_subscription.current.id
  amount          = 15000
  time_grain      = "Monthly"
  time_period { start_date = "2026-10-01T00:00:00Z" }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 80
    threshold_type = "Forecasted"
    contact_groups = [azurerm_monitor_action_group.claims_owners.id]
  }
  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 100
    threshold_type = "Actual"
    contact_emails = ["claims-owners@example.com"]
  }
}
```
### 2. Auto-shutdown for development VMs
```hcl
resource "azurerm_dev_test_global_vm_shutdown_schedule" "dev_vm" {
  virtual_machine_id    = azurerm_linux_virtual_machine.dev.id
  location              = var.location
  enabled               = true
  daily_recurrence_time = "1900"
  timezone              = "W. Europe Standard Time"
  notification_settings { enabled = false }
}
```
**Why it's right:**
- Tags are inherited automatically for cost allocation, and owners receive forecast and actual budget alerts.
- Development VMs stop every evening, and everything is defined as code and reviewable.
