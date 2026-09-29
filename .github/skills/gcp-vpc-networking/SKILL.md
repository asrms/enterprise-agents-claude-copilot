---
name: gcp-vpc-networking
description: "Google Cloud networking: Shared VPC and hub-and-spoke with Network Connectivity Center, global VPCs with regional subnets and secondary ranges, hierarchical and VPC firewall policies with tags, Cloud NAT, Private Google Access and Private Service Connect, VPC Service Controls perimeters, Cloud Load Balancing with Cloud Armor, Identity-Aware Proxy for administrative access, hybrid connectivity, and Cloud DNS. Use it when designing or reviewing networks on Google Cloud."
---

# Skill: Google Cloud VPC Networking

## Implementation Rules:
- **[ARCHITECTURE]** Use Shared VPC host projects per environment with service projects attached, or a hub-and-spoke model with Network Connectivity Center or VPC peering for larger organizations; plan non-overlapping primary and secondary ranges (including GKE pod and service ranges) across regions and on-premises.
- **[MANDATORY]** Create custom-mode VPCs only (no auto-mode or default network; enforce with the `compute.skipDefaultNetworkCreation` organization policy) with regional subnets sized for growth, VPC flow logs enabled on production subnets, and Private Google Access enabled.
- **[MANDATORY]** Manage firewalls with hierarchical firewall policies at organization or folder level for global rules (for example, allow IAP and health check ranges, deny known-bad traffic) and network firewall policies with secure tags for workload rules; default deny ingress, and no `0.0.0.0/0` ingress to management ports.
- **[MANDATORY]** Remove external IPs from VMs (organization policy `compute.vmExternalIpAccess`), provide egress through Cloud NAT with logging, and administer instances through Identity-Aware Proxy TCP forwarding with OS Login.
- **[PATTERN]** Reach Google APIs and managed services privately: Private Google Access or Private Service Connect endpoints for Google APIs, private services access or Private Service Connect for Cloud SQL, AlloyDB, and Memorystore, and PSC to publish or consume services across projects.
- **[SECURITY]** Protect sensitive data services with VPC Service Controls perimeters around projects containing BigQuery, Cloud Storage, and other supported services, with access levels and ingress/egress rules for legitimate flows, starting in dry-run mode.
- **[PATTERN]** Expose applications through Cloud Load Balancing (global external Application Load Balancer for internet traffic) with Cloud Armor security policies (preconfigured WAF rules, rate limiting, bot management) and Google-managed certificates; internal Application Load Balancers for internal services.
- **[PATTERN]** Connect on-premises with HA VPN or Cloud Interconnect with redundant attachments and Cloud Router BGP, and manage DNS with Cloud DNS private zones, forwarding and peering zones, and DNS policies for hybrid resolution.
- **[FORBIDDEN]** The default network in any project, firewall rules targeting all instances with broad source ranges, VMs with external IPs for administration, and sensitive data projects without VPC Service Controls when data exfiltration is a concern.
- **[PATTERN]** Define networking as code with Terraform (Cloud Foundation Fabric or terraform-google modules), with changes reviewed and firewall rules traceable to owners and purposes.
- **[TESTING]** Validate reachability and rules with Network Intelligence Center (Connectivity Tests, Firewall Insights for shadowed or unused rules) and automated tests for allowed and denied paths after changes.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
