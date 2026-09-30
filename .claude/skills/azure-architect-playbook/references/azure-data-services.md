# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Shared keys, public access, no resilience
```text
Azure SQL: SQL auth with admin "sqladmin" used by all apps; public access 0.0.0.0-255.255.255.255; no zone redundancy
Storage: shared key connection string in app settings; container "documents" with public blob access
Service Bus: SAS RootManageSharedAccessKey used by every producer and consumer
Backups: default only, never tested; no resource locks
```
**Why it's wrong:**
- Shared secrets with full rights are spread across applications, and data services are reachable from the internet.
- Availability and recovery do not match any stated objective and have never been verified.

## Best Practice (How to do it right)

### 1. Azure SQL with Entra-only auth, private access, and zone redundancy (Terraform)
```hcl
resource "azurerm_mssql_server" "claims" {
  name                          = "sql-claims-prod-weu"
  resource_group_name           = azurerm_resource_group.data.name
  location                      = var.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
  azuread_administrator {
    login_username              = "sg-claims-dba"
    object_id                   = var.dba_group_object_id
    azuread_authentication_only = true
  }
}

resource "azurerm_mssql_database" "claims" {
  name                 = "claims"
  server_id            = azurerm_mssql_server.claims.id
  sku_name             = "GP_Gen5_4"
  zone_redundant       = true
  storage_account_type = "Geo"
  short_term_retention_policy { retention_days = 14 }
  long_term_retention_policy {
    weekly_retention  = "P8W"
    monthly_retention = "P12M"
  }
}

resource "azurerm_management_lock" "claims_db" {
  name       = "do-not-delete"
  scope      = azurerm_mssql_database.claims.id
  lock_level = "CanNotDelete"
  notes      = "Production claims database"
}
```
### 2. Service Bus with local auth disabled and role-based access
```hcl
resource "azurerm_servicebus_namespace" "claims" {
  name                          = "sb-claims-prod-weu"
  location                      = var.location
  resource_group_name           = azurerm_resource_group.data.name
  sku                           = "Premium"
  capacity                      = 1
  premium_messaging_partitions  = 1
  local_auth_enabled            = false
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
}

resource "azurerm_role_assignment" "claims_api_sender" {
  scope                = azurerm_servicebus_namespace.claims.id
  role_definition_name = "Azure Service Bus Data Sender"
  principal_id         = azurerm_user_assigned_identity.claims_api.principal_id
}
```
**Why it's right:**
- Applications authenticate with Entra identities only; shared keys and SQL logins are disabled.
- The database is private, zone redundant, geo-backed up with long-term retention, and protected by a delete lock.
- Messaging access is granted per identity and role instead of a namespace-wide key.
