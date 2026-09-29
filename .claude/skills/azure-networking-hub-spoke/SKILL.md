---
name: azure-networking-hub-spoke
description: "Azure network architecture: hub-and-spoke with VNet peering or Azure Virtual WAN, Azure Firewall for egress and east-west inspection, user-defined routes, private endpoints and Private DNS zones, Application Gateway with WAF and Azure Front Door for ingress, NSGs and application security groups, Azure Bastion, hybrid connectivity with VPN or ExpressRoute, and IP address planning. Use it when designing or reviewing Azure networking."
---

# Skill: Azure Networking (Hub and Spoke)

## Implementation Rules:
- **[ARCHITECTURE]** Use a hub-and-spoke topology: a hub VNet (or Virtual WAN hub for many regions and branches) with shared services such as Azure Firewall, gateways, and DNS, and spoke VNets per workload peered to the hub; spokes do not peer with each other directly unless explicitly justified.
- **[MANDATORY]** Plan non-overlapping address spaces across regions, environments, and on-premises networks before deployment (with Azure Virtual Network Manager IPAM or a central register), sized for growth including AKS pod and service ranges.
- **[MANDATORY]** Route spoke egress and inter-spoke traffic through Azure Firewall (or a network virtual appliance) with user-defined routes (`0.0.0.0/0` to the firewall private IP), and define firewall rules with FQDN tags and application rules rather than broad IP ranges.
- **[MANDATORY]** Access PaaS services privately: private endpoints for Storage, SQL, Key Vault, Cosmos DB, and other services, public network access disabled on those resources, and Private DNS zones (`privatelink.*`) linked to the hub or resolved through Azure DNS Private Resolver for hybrid scenarios.
- **[PATTERN]** Publish internet-facing applications through Azure Front Door (global, with WAF and CDN) or Application Gateway with WAF v2 (regional), with origins restricted to accept traffic only from the front door (private link origins or service tags and header checks).
- **[PATTERN]** Segment within VNets with NSGs per subnet and application security groups to express rules by role (web, app, data), default-deny inbound, and NSG flow logs or VNet flow logs sent to the central workspace with Traffic Analytics.
- **[SECURITY]** Administer virtual machines through Azure Bastion or just-in-time VM access, never with public IPs and open RDP/SSH; enable DDoS Network Protection for VNets hosting critical public endpoints.
- **[PATTERN]** Connect on-premises with site-to-site VPN or ExpressRoute (with redundant circuits or VPN backup for critical workloads) terminating in the hub, and propagate routes deliberately.
- **[FORBIDDEN]** Public IPs on application VMs, NSG rules allowing `Any` from `Internet` to management ports, PaaS services with public network access enabled when private endpoints are available, and overlapping address spaces that block future connectivity.
- **[PATTERN]** Define networking as code (Bicep or Terraform with Azure Verified Modules), with Azure Policy denying public IPs in corp landing zones and enforcing private DNS integration.
- **[TESTING]** Validate connectivity and security with Network Watcher (connection troubleshoot, IP flow verify, effective routes and NSG rules) and automated tests of allowed and denied paths after changes.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
