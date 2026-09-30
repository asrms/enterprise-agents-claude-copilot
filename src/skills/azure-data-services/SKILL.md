---
name: azure-data-services
description: "Choosing and configuring Azure data and messaging services: Azure SQL Database and Managed Instance, Azure Database for PostgreSQL flexible server, Cosmos DB, Azure Cache for Redis, Storage accounts, Service Bus, Event Hubs, and Event Grid, with Entra authentication, private endpoints, zone redundancy and geo-replication, backups and point-in-time restore, encryption with customer-managed keys, and cost-aware capacity models. Use it when selecting or reviewing Azure data stores and messaging."
---

# Skill: Azure Data Services

## Implementation Rules:
- **[ARCHITECTURE]** Choose by workload: Azure SQL Database or PostgreSQL flexible server for relational data, SQL Managed Instance for lift-and-shift SQL Server compatibility, Cosmos DB for globally distributed or high-scale key-value and document access with known partition keys, Azure Cache for Redis (or Azure Managed Redis) for caching, and Storage (Blob, ADLS Gen2) for objects and analytics; record the decision.
- **[MANDATORY]** Authenticate with Microsoft Entra ID and managed identities (Entra-only authentication on Azure SQL, Entra auth on PostgreSQL, data-plane RBAC on Cosmos DB, Storage, Service Bus, and Event Hubs), and disable shared keys and local authentication where supported.
- **[MANDATORY]** Keep data services private: private endpoints with Private DNS zones, public network access disabled, and minimum TLS 1.2 enforced.
- **[MANDATORY]** Configure resilience to meet RTO/RPO: zone-redundant configurations for production, geo-replication or failover groups (Azure SQL), geo-redundant backups or read replicas where regional recovery is required, and Cosmos DB multi-region with an explicit consistency level.
- **[MANDATORY]** Protect data from loss: automated backups with point-in-time restore and long-term retention where required, soft delete and versioning on Blob Storage, immutability policies for regulated data, and resource locks on critical production resources.
- **[SECURITY]** Encrypt with platform-managed keys by default and customer-managed keys in Key Vault or Managed HSM for sensitive data, enable Microsoft Defender for SQL, Storage, and Cosmos DB, and send diagnostic and audit logs to the central workspace.
- **[PATTERN]** Messaging: Service Bus for commands and business workflows (sessions for ordering, dead-letter queues, duplicate detection), Event Grid for reactive event routing between Azure services and applications, Event Hubs for high-throughput telemetry and streaming (Kafka-compatible endpoint), each with managed identity access.
- **[PERFORMANCE]** Choose capacity models deliberately: vCore with serverless auto-pause for intermittent Azure SQL workloads, provisioned or autoscale throughput versus serverless on Cosmos DB based on traffic shape, and right-sized PostgreSQL compute with storage autogrow; design Cosmos DB partition keys for even distribution and single-partition queries.
- **[FORBIDDEN]** SQL authentication with shared admin passwords for applications, storage account keys in application settings, public blob containers for private data, and Cosmos DB cross-partition queries in hot request paths without need.
- **[PATTERN]** Manage lifecycle and cost: Blob lifecycle management to cool, cold, and archive tiers, TTL on Cosmos DB containers where appropriate, and reserved capacity for steady database workloads.
- **[TESTING]** Test point-in-time restores and failover (Azure SQL failover groups, Cosmos DB manual failover) in non-production regularly, and load-test partition key choices before production.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
