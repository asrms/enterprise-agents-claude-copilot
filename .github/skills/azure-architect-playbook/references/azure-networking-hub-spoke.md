# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Flat networking with public endpoints
```text
VNet 10.0.0.0/16 shared by prod and test
VM "app01" with public IP, NSG: Allow Any from Internet to 3389
Azure SQL: public network access enabled, firewall rule 0.0.0.0-255.255.255.255
Storage account: public endpoint used by the app over the internet
Two spokes peered directly to each other "to save time"; overlapping 10.1.0.0/16 with on-premises
```
**Why it's wrong:**
- RDP is exposed to the internet, and data services are reachable publicly.
- There is no central inspection or segmentation, and overlapping ranges prevent hybrid connectivity.

## Best Practice (How to do it right)

### 1. Spoke with forced tunneling to the hub firewall and a private endpoint (Terraform)
```hcl
resource "azurerm_route_table" "spoke_app" {
  name                = "rt-claims-prod-app"
  location            = var.location
  resource_group_name = azurerm_resource_group.network.name
  route {
    name                   = "default-to-hub-firewall"
    address_prefix         = "0.0.0.0/0"
    next_hop_type          = "VirtualAppliance"
    next_hop_in_ip_address = var.hub_firewall_private_ip
  }
}

resource "azurerm_subnet_route_table_association" "app" {
  subnet_id      = azurerm_subnet.app.id
  route_table_id = azurerm_route_table.spoke_app.id
}

resource "azurerm_private_endpoint" "sql" {
  name                = "pe-sql-claims-prod"
  location            = var.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "sql"
    private_connection_resource_id = azurerm_mssql_server.claims.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [var.private_dns_zone_ids["privatelink.database.windows.net"]]
  }
}

resource "azurerm_mssql_server" "claims" {
  # ...
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
}
```
**Why it's right:**
- All spoke egress passes through the hub firewall, and the database is reachable only through a private endpoint with central private DNS.
- Public access is disabled at the resource level, and the design is defined as code for review and policy checks.
