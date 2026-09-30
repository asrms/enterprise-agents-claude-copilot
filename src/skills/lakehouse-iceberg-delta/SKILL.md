---
name: lakehouse-iceberg-delta
description: "Lakehouse table design and operations with Apache Iceberg and Delta Lake: catalogs, hidden partitioning and clustering, schema and partition evolution, MERGE upserts, copy-on-write versus merge-on-read, compaction, snapshot expiry and vacuum, time travel, and physical deletion for privacy. Use it when designing, writing to, or maintaining open table format tables."
---

# Skill: Lakehouse Tables with Iceberg and Delta

## Implementation Rules:
- **[ARCHITECTURE]** All reads and writes go through a catalog (Iceberg REST catalog, AWS Glue, Nessie, Polaris, Unity Catalog, or the Delta log via a metastore); engines never write Parquet files directly into a table location or rely on path-based tables shared across engines without a catalog.
- **[PATTERN]** Partition for pruning, not for organization: Iceberg hidden partitioning with transforms (`days(event_ts)`, `bucket(16, customer_id)`) or Delta liquid clustering (`CLUSTER BY`); target partitions of at least 1 GB and never partition by high-cardinality columns such as ids or timestamps.
- **[PATTERN]** Evolve schemas with engine DDL (`ALTER TABLE ... ADD COLUMN`, `RENAME COLUMN`, widening type promotion) and Iceberg partition evolution (`ALTER TABLE ... ADD PARTITION FIELD`) instead of rewriting tables; enable Delta column mapping (`delta.columnMapping.mode = 'name'`) before renames or drops.
- **[PATTERN]** Upserts and CDC use `MERGE INTO` with a deduplicated source (one row per key, latest by sequence number); choose copy-on-write for read-heavy tables and merge-on-read (`write.merge.mode`, `write.update.mode`, `write.delete.mode` = `merge-on-read`, or Delta deletion vectors) for frequent small updates.
- **[MANDATORY]** Schedule table maintenance for every table: compaction (`CALL <catalog>.system.rewrite_data_files`, Delta `OPTIMIZE`), snapshot expiry (`expire_snapshots` with `older_than` and `retain_last`), orphan file cleanup (`remove_orphan_files`), manifest rewrite for Iceberg, and `VACUUM` for Delta.
- **[FORBIDDEN]** Disabling Delta's retention check (`spark.databricks.delta.retentionDurationCheck.enabled=false`) or expiring snapshots and vacuuming with a retention shorter than the longest running query, streaming checkpoint lag, or time-travel requirement (7 days is a sane default).
- **[CONFIGURATION]** Set table properties explicitly at creation: `format-version`, `write.target-file-size-bytes` (256-512 MB), `write.distribution-mode`, and snapshot or log retention (`history.expire.max-snapshot-age-ms`, `delta.logRetentionDuration`, `delta.deletedFileRetentionDuration`).
- **[SECURITY]** Enforce access in the catalog (grants, row filters, column masks, credential vending with short-lived, table-scoped credentials) rather than raw bucket policies per user; storage is encrypted and buckets are not public.
- **[SECURITY]** Privacy deletions are complete only after the deleted rows are no longer in any retained snapshot: run `DELETE`, then compaction, snapshot expiry, and vacuum within the legal deadline, and document it.
- **[PERFORMANCE]** Writers handle optimistic concurrency conflicts with bounded retries; avoid many concurrent writers on the same partitions and commit in larger batches instead of many tiny commits.
- **[TESTING]** Test DDL, MERGE logic, and maintenance jobs in CI against a local catalog (Spark with an Iceberg Hadoop or JDBC catalog, or local Delta tables), asserting row results, snapshot counts, and time travel with `VERSION AS OF`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
