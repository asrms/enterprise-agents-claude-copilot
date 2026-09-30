---
name: dbt-modeling
description: "Analytics engineering with dbt: staging, intermediate, and mart layers, sources and ref, incremental and microbatch models, model contracts and versions, data tests and unit tests, source freshness, and slim CI with state selection and deferral. Use it when writing, reviewing, or refactoring dbt projects on any warehouse or lakehouse adapter."
---

# Skill: dbt Modeling

## Implementation Rules:
- **[ARCHITECTURE]** Layer the project: `models/staging/<source>/stg_<source>__<entity>.sql` (one model per source table, rename, cast, and light cleaning only), `models/intermediate/` (reusable joins and business logic, not exposed), and `models/marts/<domain>/` (`fct_` and `dim_` models consumed by BI and applications).
- **[MANDATORY]** Reference raw data only through `{{ source('shop', 'orders') }}` declared in `_sources.yml` and models only through `{{ ref('stg_shop__orders') }}`; hardcoded database or schema names break lineage, environments, and `--defer`.
- **[MANDATORY]** Every model documents its grain in the description and has a primary key tested with `unique` and `not_null`; surrogate keys are built deterministically (`dbt_utils.generate_surrogate_key([...])`), never with random or sequence values.
- **[PATTERN]** Large fact tables are incremental: `materialized='incremental'` with an explicit `unique_key`, an `incremental_strategy` supported by the adapter (`merge`, `delete+insert`, `insert_overwrite`, or `microbatch` with `event_time`, `batch_size`, and `lookback`), a lookback window for late-arriving rows inside `{% if is_incremental() %}`, and `on_schema_change='append_new_columns'` or `'fail'`.
- **[ARCHITECTURE]** Public marts declare `access: public`, `group`, and an enforced contract (`contract: {enforced: true}` with `data_type` for every column); breaking changes ship as a new model version (`versions:` and `latest_version`) with a deprecation date for the old one.
- **[TESTING]** Add generic data tests (`relationships`, `accepted_values`, `dbt_utils.expression_is_true`) for business invariants and `unit_tests:` with `given`/`expect` rows for non-trivial SQL logic (window functions, incremental branches, date edge cases); set `severity` and `warn_if`/`error_if` deliberately.
- **[MANDATORY]** Declare `freshness` (`warn_after`, `error_after`) and `loaded_at_field` for every source and run `dbt source freshness` before the build in scheduled jobs.
- **[FORBIDDEN]** `SELECT *` in marts, business logic in staging models, ephemeral chains that hide expensive SQL, copy-pasted SQL instead of an intermediate model or macro, and editing production tables outside dbt.
- **[PERFORMANCE]** Use warehouse-specific configs (`cluster_by`, `partition_by`, `sort`, `dist`) on large models, filter early in CTEs, and inspect `target/run_results.json` timings to find the slowest nodes before optimizing.
- **[SECURITY]** Credentials live in `profiles.yml` read from environment variables (`{{ env_var('DBT_ENV_SECRET_PASSWORD') }}`) or from key-pair/OAuth authentication, never in the repository; access to marts is granted through `grants` config to roles, not users.
- **[TESTING]** CI runs `dbt build --select state:modified+ --defer --state <prod-artifacts>` in an isolated schema, lints SQL with SQLFluff (dbt templater), and fails on test errors or contract violations; pin `require-dbt-version` and package versions in `packages.yml`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
