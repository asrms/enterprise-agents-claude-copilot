---
name: azure-cost-management
description: "Cost management and FinOps on Azure: tagging and cost allocation with policy, budgets and anomaly alerts in Microsoft Cost Management, cost exports and FOCUS-formatted data, Azure Advisor cost recommendations, Azure Reservations and savings plans, Azure Hybrid Benefit, autoscaling and auto-shutdown, storage tiering, Dev/Test pricing, and unit economics. Use it when reviewing or reducing Azure spend or setting up cost governance."
---

# Skill: Azure Cost Management

## Implementation Rules:
- **[MANDATORY]** Make costs attributable: subscription per workload and environment, required tags (`costCenter`, `owner`, `environment`, `application`) enforced or inherited with Azure Policy (for example "Require a tag on resource groups" and "Inherit a tag from the resource group"), and tag inheritance enabled in Cost Management.
- **[MANDATORY]** Set budgets at subscription and resource group scope with actual and forecast alerts to owners (and action groups for automation), and enable anomaly alerts so unexpected increases are detected within a day.
- **[PATTERN]** Export cost data on a schedule (Cost Management exports in the FOCUS format to a storage account) for reporting per team and product in Power BI or the FinOps toolkit, reviewed monthly with owners.
- **[PATTERN]** Act on Azure Advisor cost recommendations: rightsize or shut down underutilized VMs, scale down oversized App Service plans and databases, delete unattached disks, public IPs, and old snapshots, validating with utilization metrics first.
- **[PATTERN]** Commit for steady usage: Azure savings plans for compute (flexible across services and regions) and Azure Reservations for stable resources (VMs, SQL Database vCores, Cosmos DB throughput, Redis), sized to the baseline and monitored for utilization.
- **[PATTERN]** Apply licensing benefits: Azure Hybrid Benefit for Windows Server and SQL Server with eligible licenses, and Dev/Test subscriptions for non-production workloads.
- **[PERFORMANCE]** Scale with demand: autoscale for App Service, VM Scale Sets, Container Apps, and AKS (cluster autoscaler), serverless tiers for intermittent workloads (Azure SQL serverless, Functions consumption), and Spot VMs for interruptible batch work.
- **[PATTERN]** Reduce idle and storage costs: auto-shutdown schedules for development VMs, expiring sandbox resources, Blob lifecycle management to cooler tiers, log retention and table plans (Basic or Auxiliary logs) in Log Analytics for high-volume, low-query data.
- **[FORBIDDEN]** Untagged production resources, reservations purchased without utilization analysis, ignoring budget and anomaly alerts, and cost cuts that remove zone redundancy or backups required by reliability targets without an explicit decision.
- **[PATTERN]** Track unit economics (cost per transaction, per customer, per environment) and include cost in architecture decisions and Well-Architected reviews.
- **[SECURITY]** Limit who can purchase reservations and savings plans and change billing settings (Billing and Reservation roles), and review Marketplace purchases.
- **[TESTING]** Estimate cost impact of infrastructure changes in pull requests (Azure pricing calculator for designs, Infracost for Terraform), and verify savings after changes with Cost Management comparisons.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
