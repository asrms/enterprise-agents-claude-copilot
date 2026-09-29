---
name: aws-cost-optimization-finops
description: "Cost optimization and FinOps on AWS: cost allocation tags and account structure, AWS Budgets and Cost Anomaly Detection, Cost Explorer and CUR 2.0 data exports, rightsizing with Compute Optimizer, Savings Plans and Reserved Instances, Spot instances, Graviton, storage and data transfer optimization, idle resource cleanup, and unit economics. Use it when reviewing or reducing AWS spend or setting up cost governance."
---

# Skill: AWS Cost Optimization and FinOps

## Implementation Rules:
- **[MANDATORY]** Make costs attributable: account-per-workload-and-environment structure, mandatory cost allocation tags (for example `cost-center`, `owner`, `environment`, `application`) enforced with tag policies and IaC checks, and activated as cost allocation tags in Billing.
- **[MANDATORY]** Set guardrails early: AWS Budgets per account and team with forecast-based alerts, Cost Anomaly Detection monitors with notifications to owners, and service quotas or SCPs preventing unapproved expensive services or Regions.
- **[PATTERN]** Build visibility with Cost Explorer for exploration and CUR 2.0 data exports to S3 queried with Athena or visualized with dashboards (for example the Cloud Intelligence Dashboards), reported per team and per product regularly.
- **[PATTERN]** Rightsize continuously with Compute Optimizer and Trusted Advisor recommendations (EC2, EBS, Lambda memory, ECS on Fargate), validating with utilization metrics before changing production.
- **[PATTERN]** Commit for steady usage: Compute Savings Plans for flexible compute coverage, EC2 Instance Savings Plans or Reserved Instances for stable families, and Reserved Instances or reserved nodes for RDS, ElastiCache, OpenSearch, and Redshift; target a coverage level based on the baseline, not the peak.
- **[PERFORMANCE]** Use cheaper capacity where it fits: Graviton instances and arm64 Lambda, Spot for fault-tolerant and batch workloads (with capacity-optimized allocation and interruption handling), and Fargate Spot for tolerant container tasks.
- **[PATTERN]** Optimize storage and data transfer: S3 Intelligent-Tiering and lifecycle rules, gp3 instead of gp2 volumes with right-sized IOPS, deletion of unattached volumes and old snapshots, VPC endpoints to avoid NAT gateway data processing charges for AWS service traffic, and CloudFront to reduce origin egress.
- **[PATTERN]** Remove idle resources automatically: schedules to stop non-production environments outside working hours (Instance Scheduler), expiry tags for ephemeral environments, and regular cleanup of unused load balancers, Elastic IPs, and log groups without retention.
- **[FORBIDDEN]** Untagged resources in production accounts, purchasing commitments without analyzing a stable baseline, optimizing cost by removing redundancy required by availability targets without an explicit decision, and ignoring anomaly alerts.
- **[PATTERN]** Track unit economics (cost per order, per active user, per tenant, per GB processed) alongside total spend, so growth and efficiency can be distinguished.
- **[SECURITY]** Restrict billing and purchasing permissions (commitment purchases, marketplace subscriptions) to the FinOps and management roles, and review Marketplace and third-party charges.
- **[TESTING]** Review cost impact in design and pull requests (for example with Infracost for Terraform changes), and run a monthly FinOps review with owners covering anomalies, recommendations, commitment utilization, and savings realized.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
