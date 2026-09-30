---
name: spark-performance
description: "Apache Spark performance for batch and structured workloads with PySpark and Spark SQL: Adaptive Query Execution, join strategies and broadcast, partitioning and file sizing, skew handling, avoiding Python UDFs and driver collects, caching discipline, reading plans and the Spark UI, and DataFrame testing. Use it when writing, reviewing, or tuning Spark jobs."
---

# Skill: Spark Performance

## Implementation Rules:
- **[MANDATORY]** Diagnose before tuning: read `df.explain(mode="formatted")` and the Spark UI (stages, shuffle read/write, spill, task time distribution) and fix the dominant cost; every tuning change is justified by a before/after measurement on production-sized data.
- **[CONFIGURATION]** Keep Adaptive Query Execution on (`spark.sql.adaptive.enabled`, `spark.sql.adaptive.coalescePartitions.enabled`, `spark.sql.adaptive.skewJoin.enabled`) and set `spark.sql.shuffle.partitions` from data volume (target 100-200 MB per shuffle partition) instead of leaving a fixed value for every job.
- **[PERFORMANCE]** Prefer built-in functions (`pyspark.sql.functions`) over Python UDFs; when custom Python is unavoidable use Arrow-backed `pandas_udf` or `mapInPandas`/`mapInArrow`, never row-at-a-time `udf` on large data.
- **[PERFORMANCE]** Choose join strategies deliberately: broadcast small dimensions (`F.broadcast(dim)` or `spark.sql.autoBroadcastJoinThreshold`), filter and project before joins, and join on columns with matching types to avoid implicit casts that disable pushdown.
- **[PERFORMANCE]** Handle skew explicitly: rely on AQE skew join first, then salt hot keys or split them into a separate path; check the max versus median task duration of the stage to confirm.
- **[PATTERN]** Read with pruning: select only needed columns, filter on partition and clustering columns early, and verify `PushedFilters` and `PartitionFilters` in the plan; store data in columnar formats (Parquet, Iceberg, Delta), never CSV or JSON for intermediate data.
- **[PATTERN]** Write files of 128 MB-1 GB: `repartition` by the partition columns before a partitioned write, `coalesce` only to reduce partitions without a shuffle, and use table maintenance (compaction) rather than thousands of tiny files.
- **[FORBIDDEN]** `collect()`, `toPandas()`, or `count()` used for control flow on large DataFrames, loops that call actions per row or per key, `cache()` without reuse or `unpersist()`, and `repartition(1)` for large outputs.
- **[PATTERN]** Jobs are idempotent: overwrite target partitions with `spark.sql.sources.partitionOverwriteMode=dynamic` or use table `MERGE`, never append blindly on retry.
- **[CONFIGURATION]** Size executors explicitly (`spark.executor.memory`, `spark.executor.memoryOverhead`, `spark.executor.cores` of 4-5) or use dynamic allocation with bounds; treat spill to disk and GC time above 10% as signals to revisit partitioning before adding memory.
- **[SECURITY]** Credentials come from instance or workload identity, never from code or `spark-submit` arguments; configure `spark.redaction.regex` so secrets do not appear in the UI or event logs.
- **[TESTING]** Unit-test transformations as pure functions `DataFrame -> DataFrame` with a local `SparkSession` fixture and `pyspark.testing.assertDataFrameEqual`/`assertSchemaEqual`, including nulls, duplicates, and skewed keys.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
