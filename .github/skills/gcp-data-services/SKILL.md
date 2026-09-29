---
name: gcp-data-services
description: "Choosing and configuring Google Cloud data and messaging services: Cloud SQL, AlloyDB, Spanner, Firestore, Bigtable, Memorystore, BigQuery, Cloud Storage, and Pub/Sub, with private connectivity, IAM authentication, high availability and cross-region options, backups and point-in-time recovery, CMEK, data governance, and cost-aware configuration. Use it when selecting or reviewing data stores, analytics, and messaging on Google Cloud."
---

# Skill: Google Cloud Data Services

## Implementation Rules:
- **[ARCHITECTURE]** Choose by workload: Cloud SQL for standard PostgreSQL/MySQL/SQL Server, AlloyDB for demanding PostgreSQL with analytics acceleration, Spanner for globally consistent relational data at scale, Firestore for document data in mobile and web apps, Bigtable for high-throughput wide-column time series, Memorystore for caching, BigQuery for analytics, Cloud Storage for objects; record the decision.
- **[MANDATORY]** Keep databases private: private IP via private services access or Private Service Connect, no public IP (organization policy `sql.restrictPublicIp`), connections through the Cloud SQL or AlloyDB connectors with IAM database authentication where supported.
- **[MANDATORY]** Configure availability to meet RTO/RPO: Cloud SQL and AlloyDB high availability (regional) for production, cross-region replicas or Spanner multi-region configurations where regional recovery is required, and multi-zone Memorystore with replicas.
- **[MANDATORY]** Protect data: automated backups with point-in-time recovery, deletion protection on production instances, Cloud Storage object versioning, soft delete, and retention policies or bucket locks for regulated data, and export or cross-region backups for critical datasets.
- **[SECURITY]** Use customer-managed encryption keys (Cloud KMS) for sensitive datasets when required by policy, uniform bucket-level access with public access prevention on buckets, and VPC Service Controls around projects holding sensitive BigQuery and Storage data.
- **[PATTERN]** Govern analytics data in BigQuery: datasets per domain and sensitivity, IAM at dataset or table level, policy tags for column-level security, row-level access policies, authorized views for sharing, and data classification with Sensitive Data Protection where appropriate.
- **[PATTERN]** Messaging with Pub/Sub: topics per event type with schemas, subscriptions per consumer with dead-letter topics and retry policies, ordering keys only where ordering is required, exactly-once delivery where supported and needed, and idempotent consumers.
- **[PERFORMANCE]** Control cost and performance: right-size database tiers, use committed use discounts for steady databases, BigQuery partitioned and clustered tables with `require_partition_filter`, capacity-based pricing (editions) or on-demand chosen by usage pattern, and Cloud Storage Autoclass or lifecycle rules.
- **[FORBIDDEN]** Public IPs with `0.0.0.0/0` authorized networks, database passwords in code, BigQuery queries without partition filters on large tables in scheduled jobs, and publicly readable buckets for private data.
- **[PATTERN]** Monitor with Cloud Monitoring and Query Insights (Cloud SQL, AlloyDB): CPU, memory, storage, replication lag, connections, slow queries, Pub/Sub oldest unacked message age and dead-letter volume.
- **[TESTING]** Test backup restores and HA failover in non-production regularly, verify IAM and VPC Service Controls with negative tests, and load-test data models (Spanner and Bigtable key design, Firestore indexes) before production.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
