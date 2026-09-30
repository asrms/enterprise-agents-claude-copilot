---
name: aws-data-services
description: "Choosing and configuring AWS data and messaging services: Aurora and RDS, DynamoDB, ElastiCache and MemoryDB, S3, OpenSearch, SQS, SNS, EventBridge, Kinesis, and MSK, with encryption, private access, high availability, backups and point-in-time recovery, capacity modes, lifecycle policies, and security baselines. Use it when selecting or reviewing AWS databases, storage, and messaging services."
---

# Skill: AWS Data Services

## Implementation Rules:
- **[ARCHITECTURE]** Choose by access pattern and consistency needs: Aurora (PostgreSQL/MySQL) for relational workloads, DynamoDB for key-value access at any scale with known access patterns, ElastiCache/MemoryDB for caching and low-latency data structures, S3 for objects and data lakes, OpenSearch for search and log analytics; record the decision in an ADR.
- **[MANDATORY]** Encrypt everything at rest with KMS (customer-managed keys for sensitive data) and in transit (enforce TLS: `rds.force_ssl` or `require_secure_transport`, `aws:SecureTransport` conditions on S3 bucket policies, in-transit encryption for ElastiCache and MSK).
- **[MANDATORY]** Keep data services private: no public accessibility for RDS/Aurora, S3 Block Public Access enabled at the account level, VPC endpoints for S3, DynamoDB, SQS, and other services, and security groups allowing only application security groups.
- **[PATTERN]** Design for availability: Aurora with replicas in multiple AZs (or RDS Multi-AZ DB clusters), DynamoDB global tables only when multi-region writes are required, ElastiCache with Multi-AZ and automatic failover, MSK across three AZs.
- **[MANDATORY]** Enable backups and recovery: automated backups with point-in-time recovery (RDS/Aurora, DynamoDB PITR), deletion protection on production databases, S3 Versioning with Object Lock where immutability is required, and AWS Backup plans with cross-account and cross-region copies for critical data.
- **[PATTERN]** Messaging: SQS for work queues (with DLQs and visibility timeouts aligned to consumers; FIFO only when ordering or exactly-once processing per group is needed), SNS or EventBridge for fan-out and event routing (EventBridge rules and archive/replay for domain events), Kinesis or MSK for high-throughput ordered streams.
- **[PERFORMANCE]** Pick capacity modes deliberately: DynamoDB on-demand for spiky or unknown traffic and provisioned with auto scaling for steady load; Aurora Serverless v2 for variable workloads; Graviton-based instance classes; and RDS Proxy for connection pooling from serverless or highly concurrent clients.
- **[PATTERN]** Manage the data lifecycle: S3 lifecycle rules to transition to Intelligent-Tiering or Glacier classes and expire objects, DynamoDB TTL for expiring items, and log retention settings on every log group and index.
- **[SECURITY]** Access data with IAM roles scoped to specific tables, buckets, prefixes, and actions; use IAM database authentication or Secrets Manager with automatic rotation for database credentials; enable audit logging (CloudTrail data events for sensitive buckets, database activity logs).
- **[FORBIDDEN]** Public S3 buckets for application data (use CloudFront with origin access control for public content), database credentials in code or plaintext parameters, single-AZ production databases, and DynamoDB scans in request paths.
- **[PATTERN]** Monitor with CloudWatch alarms for storage, CPU and memory, replication lag, throttled requests, queue age and DLQ depth, and consumer lag, plus Performance Insights or Database Insights for query analysis.
- **[TESTING]** Test restores regularly (point-in-time restore to a new instance, S3 version recovery), fail over Multi-AZ databases in non-production, and validate IAM policies with Access Analyzer before deployment.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
