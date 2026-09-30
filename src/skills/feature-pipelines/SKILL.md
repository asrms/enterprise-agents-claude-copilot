---
name: feature-pipelines
description: "Feature engineering pipelines for machine learning: preventing training-serving skew, point-in-time correct joins, feature stores (Feast, Databricks, SageMaker, Vertex AI) with offline and online stores, reusable transformation code, backfills, label leakage prevention, feature validation, and freshness monitoring. Use it when building or reviewing features for training and online inference."
---

# Skill: Feature Pipelines

## Implementation Rules:
- **[MANDATORY]** Use the same transformation code for training and serving (a shared library, a feature store transformation, or a pipeline object such as a scikit-learn `Pipeline` or TorchScript/ONNX preprocessing exported with the model) to prevent training-serving skew.
- **[MANDATORY]** Build training sets with point-in-time correct joins: for each label event, use only feature values known before the event timestamp (`as-of` joins, feature store `get_historical_features` with event timestamps); never join features by entity id alone.
- **[FORBIDDEN]** Label leakage: features computed from data after the prediction time, target encoding fitted on the full dataset, normalization statistics computed on validation or test data, and random splits for time-dependent problems (use time-based splits).
- **[ARCHITECTURE]** Use a feature store when features are shared across models or needed online with low latency: offline store for training and batch scoring, online store (Redis, DynamoDB, Bigtable, managed stores) for serving, materialized by scheduled or streaming jobs.
- **[PATTERN]** Define features declaratively with entity, value type, timestamp, owner, description, and TTL; version feature definitions and treat breaking changes like API changes.
- **[PATTERN]** Compute batch features incrementally with the data platform (dbt, Spark) and streaming features with windowed aggregations (Flink, Spark Structured Streaming) using event time and watermarks.
- **[MANDATORY]** Validate features before training and before materialization: schema, null rates, ranges, category sets, and distribution checks against a reference, failing the pipeline on violations.
- **[PERFORMANCE]** Keep online feature retrieval within the latency budget: batch lookups per request, precompute expensive aggregations, and set TTLs so stale values are detected rather than served silently.
- **[SECURITY]** Apply data classification to features: avoid raw personal data as features when not necessary, pseudonymize identifiers, respect consent and retention, and restrict access to sensitive feature views.
- **[PATTERN]** Backfill features with the same code used for incremental computation, logging the feature version and time range, so historical training data matches production behavior.
- **[TESTING]** Unit-test transformations with small fixtures including edge cases (nulls, unseen categories, time zones), test point-in-time correctness with synthetic timelines, and compare online and offline feature values for a sample of entities to detect skew.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
