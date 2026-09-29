---
name: aws-networking-vpc
description: "AWS VPC network design: IPAM-planned CIDRs, multi-AZ subnet tiers, NAT gateways, Transit Gateway or Cloud WAN, centralized inspection with AWS Network Firewall, VPC endpoints and PrivateLink, security groups, flow logs, Route 53 Resolver, and Session Manager instead of bastions. Use it when designing, reviewing, or troubleshooting AWS networking with Terraform."
---

# Skill: AWS Networking and VPC Design

## Implementation Rules:
- **[ARCHITECTURE]** Allocate non-overlapping CIDRs from Amazon VPC IPAM pools per Region and environment, sized for growth (and future EKS pod IPs), so VPCs can be connected later without renumbering.
- **[ARCHITECTURE]** Spread every VPC across at least two, preferably three, Availability Zones with separate subnet tiers: public (load balancers and NAT only), private application, and private data subnets without a route to the internet; each tier has one route table per AZ where egress differs.
- **[PATTERN]** Connect many VPCs with AWS Transit Gateway (or AWS Cloud WAN for global networks) using separate route tables for production, non-production, and shared services; use VPC peering only for a few VPCs, and VPC Lattice or PrivateLink for service-to-service exposure across accounts.
- **[SECURITY]** Centralize egress and east-west inspection in a network account (AWS Network Firewall or Gateway Load Balancer appliances) when compliance requires it, with domain allow-lists for outbound traffic; otherwise deploy one NAT gateway per AZ so an AZ failure does not break egress for the others.
- **[SECURITY]** Reach AWS services privately: gateway endpoints for S3 and DynamoDB in every VPC, interface endpoints for services the workload calls (STS, ECR, Secrets Manager, KMS, CloudWatch Logs), with endpoint policies scoped to the organization and private DNS enabled.
- **[SECURITY]** Security groups are the primary control: one per component, ingress referencing other security groups instead of CIDRs, least ports, and egress narrowed where feasible; NACLs stay coarse and stateless-safe. Manage rules with `aws_vpc_security_group_ingress_rule` and `aws_vpc_security_group_egress_rule` resources.
- **[FORBIDDEN]** `0.0.0.0/0` ingress on SSH, RDP, or database ports, databases or caches in public subnets, public IPs on instances that do not serve internet traffic, bastion hosts with SSH keys (use Systems Manager Session Manager), and a single NAT gateway shared by all AZs in production.
- **[MANDATORY]** Enable VPC flow logs for every VPC (to S3 or CloudWatch Logs in the log archive account), Route 53 Resolver query logging, and Route 53 Resolver DNS Firewall for egress domain filtering where data exfiltration risk is high.
- **[CONFIGURATION]** Use VPC Block Public Access at the account level where no internet ingress is expected, Route 53 private hosted zones shared through Resolver rules for hybrid DNS, and Site-to-Site VPN or Direct Connect with redundant connections for on-premises links.
- **[PERFORMANCE]** Keep chatty traffic within an AZ, use gateway endpoints to avoid NAT data processing for S3 and DynamoDB traffic, and check MTU and throughput limits for Transit Gateway and VPN paths.
- **[TESTING]** Verify reachability intent with VPC Reachability Analyzer and Network Access Analyzer (for example "no path from the internet to data subnets"), and run these checks after network changes.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
