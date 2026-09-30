---
name: data-quality-testing
description: "Data quality engineering for pipelines: checks on schema, volume, freshness, uniqueness, validity, and referential integrity with dbt tests, Soda, Great Expectations, or pandera, severity levels, write-audit-publish, quarantine of bad records, reconciliation, anomaly detection, and data contracts. Use it when adding quality gates to batch or streaming data pipelines."
---

# Skill: Data Quality Testing

## Implementation Rules:
- **[MANDATORY]** Every published dataset has checks in the six dimensions that matter for it: schema (required columns and types), volume (row count within expected bounds), freshness (max event or load time), uniqueness (primary key), validity (ranges, enums, formats), and referential integrity (foreign keys resolve).
- **[ARCHITECTURE]** Quality gates run before consumers see the data: write-audit-publish (write to a staging table or an Iceberg branch, audit with checks, then swap, fast-forward, or merge), so a failed audit never exposes partial or corrupt data.
- **[PATTERN]** Checks are declarative and versioned next to the pipeline (dbt `data_tests`, SodaCL `checks for <dataset>`, Great Expectations suites, pandera `DataFrameModel`), reviewed like code, and never maintained only in a UI.
- **[PATTERN]** Every check has an explicit severity: `error` blocks publication and pages the owner, `warn` records the result and opens a ticket; thresholds are relative where data grows (percentage of nulls, row count versus the trailing 7-day median) rather than magic absolute numbers.
- **[PATTERN]** Record-level failures are quarantined, not dropped: invalid rows go to a `<table>_quarantine` table with the failed rule, run id, and timestamp, and the pipeline fails when the quarantine rate exceeds its threshold.
- **[MANDATORY]** Reconcile across hops: source versus target row counts and control totals (sum of amounts) per partition, compared automatically after each load.
- **[ARCHITECTURE]** Producer-consumer expectations are written as data contracts (schema, semantics, SLAs, owner, for example in the Open Data Contract Standard format) and enforced in the producer's CI, so breaking changes fail before deployment.
- **[FORBIDDEN]** Silent coercion (casting invalid values to null without counting them), `try/except: pass` around validation, disabling a failing check to unblock a release without an owner and expiry, and checks that only run manually.
- **[PERFORMANCE]** Run checks on the new partition or increment, not on the full history; use sampling only for expensive distribution checks and never for primary key and null checks.
- **[SECURITY]** Check results, samples of failing rows, and quarantine tables inherit the classification of the source data: mask personal data in alerts and reports and restrict access to quarantine tables.
- **[TESTING]** Pipeline code is unit-tested with small fixture datasets that include nulls, duplicates, late rows, out-of-range values, and schema drift, asserting that the right rows are rejected or quarantined.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
