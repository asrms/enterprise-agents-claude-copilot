---
name: database-backup-ha
description: "Database backup, recovery, and high availability: RPO/RTO targets, point-in-time recovery with WAL/binlog archiving, pgBackRest and managed snapshots, restore drills, replication and automatic failover (Patroni, cloud multi-AZ), read replicas, and disaster recovery across regions. Use it when designing or reviewing database resilience."
---

# Skill: Database Backup and High Availability

## Implementation Rules:
- **[MANDATORY]** Start from agreed targets: Recovery Point Objective (maximum data loss) and Recovery Time Objective (maximum downtime) per database, derived from business impact; backup, replication, and DR designs are chosen to meet them and documented.
- **[MANDATORY]** Point-in-time recovery for production: full or incremental base backups plus continuous transaction log archiving (PostgreSQL WAL with pgBackRest/WAL-G/Barman, MySQL binlogs, SQL Server log backups) or the managed equivalent (RDS/Aurora PITR, Azure SQL, Cloud SQL).
- **[MANDATORY]** A backup is not valid until a restore has been tested: automated restore drills (at least monthly) restore to an isolated environment, run integrity checks and smoke queries, and record the measured restore time against the RTO.
- **[SECURITY]** Backups are encrypted, stored in a different account/subscription and region than production, protected by immutability or object lock against ransomware and accidental deletion, and accessible only to a dedicated backup role.
- **[PATTERN]** Follow the 3-2-1 principle (three copies, two media or services, one off-site/offline or immutable) and define backup retention consistent with the data retention policy.
- **[ARCHITECTURE]** High availability uses a primary with synchronous or semi-synchronous standby in another availability zone and automatic failover (Patroni with etcd/Consul, CloudNativePG, Aurora/RDS Multi-AZ, SQL Server Always On, MySQL Group Replication/InnoDB Cluster); failover is fenced to avoid split brain.
- **[PATTERN]** Applications survive failover: connect through a stable endpoint (DNS, proxy, or cluster service), use connection pools with validation and retry with backoff for transient errors, and keep transactions short and idempotent where retries are possible.
- **[PATTERN]** Read replicas serve read scaling and reporting; the application tolerates replication lag explicitly (read-your-writes routed to the primary, lag monitored and bounded).
- **[ARCHITECTURE]** Disaster recovery across regions matches the RTO/RPO: backup copy to another region (hours), cross-region replicas (minutes), or active-active only when truly required and the data model supports conflict handling. The DR runbook is written and exercised at least yearly.
- **[PERFORMANCE]** Schedule base backups to limit load (from a standby where supported), monitor backup duration and size trends, and ensure WAL/binlog archiving keeps up (archive lag alerts) so disks do not fill.
- **[MANDATORY]** Monitoring and alerting cover backup success and age, archive lag, replication lag, replica health, failover events, and storage headroom; a missing backup is an incident.
- **[TESTING]** Failover is tested in non-production regularly (chaos drills: kill the primary, partition the network) and the application's behavior during failover is measured.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
