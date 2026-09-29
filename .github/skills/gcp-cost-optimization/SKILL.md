---
name: gcp-cost-optimization
description: "Cost optimization and FinOps on Google Cloud: labels and project structure for allocation, budgets with alerts and programmatic notifications, detailed billing export to BigQuery, Active Assist recommenders for idle and rightsizing, committed use discounts, Spot VMs, autoscaling and scale to zero, BigQuery cost controls, storage classes and Autoclass, network egress, and unit economics. Use it when reviewing or reducing Google Cloud spend or setting up cost governance."
---

# Skill: Google Cloud Cost Optimization

## Implementation Rules:
- **[MANDATORY]** Make costs attributable: one project per workload and environment, required labels (`cost-center`, `owner`, `env`, `app`) set by the project factory and on resources, and billing export (detailed usage cost) to BigQuery enabled for the billing account.
- **[MANDATORY]** Create budgets per project or folder with threshold alerts on actual and forecasted spend to owners, and Pub/Sub budget notifications for automated responses in non-production (for example, notifying or disabling expensive resources).
- **[PATTERN]** Report costs from the BigQuery billing export (Looker Studio or FinOps dashboards) per team, product, and service, reviewed monthly with owners; use cost anomaly detection where available.
- **[PATTERN]** Act on Active Assist recommendations: idle VMs, disks, IP addresses, and Cloud SQL instances; VM and Cloud SQL rightsizing; unattended projects; validated with utilization before changing production.
- **[PATTERN]** Commit for steady usage with committed use discounts (resource-based for Compute Engine, spend-based for services such as Cloud SQL, Cloud Run, and GKE where offered), sized to the baseline; sustained use discounts apply automatically to eligible VMs.
- **[PERFORMANCE]** Use elastic and cheaper capacity: autoscaling managed instance groups and GKE cluster autoscaler or Autopilot, Cloud Run with request-based billing and scale to zero for intermittent services, Spot VMs for fault-tolerant batch jobs, and cost-efficient machine families (for example E2, Tau T2A/T2D, or Arm-based C4A where compatible).
- **[PATTERN]** Control BigQuery costs: partitioning and clustering with required partition filters, `maximum_bytes_billed` on queries from applications, custom query quotas per user or project, editions with autoscaling slots for predictable workloads, and materialized views for repeated aggregations.
- **[PATTERN]** Optimize storage and network: Cloud Storage Autoclass or lifecycle rules to Nearline, Coldline, and Archive, deletion of old snapshots and images, regional placement close to users and data, Cloud CDN for egress-heavy content, and Private Google Access to keep API traffic off NAT where possible.
- **[FORBIDDEN]** Unlabeled resources in production projects, commitments purchased without baseline analysis, disabling redundancy required by availability targets to cut cost without a decision, and ignoring budget alerts.
- **[PATTERN]** Track unit economics (cost per order, per tenant, per 1,000 requests) with billing data joined to business metrics.
- **[SECURITY]** Restrict billing administration and commitment purchases to FinOps and management roles (`roles/billing.admin` held by few), and monitor billing account changes.
- **[TESTING]** Estimate the cost of changes in design and pull requests (Google Cloud pricing calculator, Infracost for Terraform), and verify realized savings in the billing export after changes.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
