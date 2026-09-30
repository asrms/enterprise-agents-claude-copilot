---
name: airflow-orchestration
description: "Workflow orchestration with Apache Airflow 3: TaskFlow DAGs with the airflow.sdk API, idempotent tasks bound to the data interval, asset-aware scheduling, retries and timeouts, deferrable sensors, pools, secrets backends, dynamic task mapping, and DAG testing. Use it when writing, reviewing, or migrating Airflow DAGs and pipelines."
---

# Skill: Airflow Orchestration

## Implementation Rules:
- **[ARCHITECTURE]** Airflow orchestrates, it does not process: heavy transformations run in the warehouse, Spark, dbt, or containers (`KubernetesPodOperator`), and tasks only trigger and monitor them; workers never hold large datasets in memory.
- **[MANDATORY]** Write DAGs with the Airflow 3 Task SDK (`from airflow.sdk import dag, task, Asset`), an explicit `schedule`, a fixed timezone-aware `start_date`, `catchup` set deliberately, `max_active_runs`, `tags`, and an `owner`; no deprecated `schedule_interval` or `airflow.datasets` imports.
- **[MANDATORY]** Tasks are idempotent and deterministic: they process exactly the run's `data_interval_start`/`data_interval_end`, overwrite or merge their target partition, and never depend on `datetime.now()`, so retries and backfills give the same result.
- **[FORBIDDEN]** Top-level code that queries databases, calls APIs, reads `Variable.get`, or imports heavy libraries at module import time (it runs on every DAG parse); direct access to the Airflow metadata database from tasks; passing large data through XCom (pass URIs or table names instead).
- **[CONFIGURATION]** Set `default_args` with `retries`, `retry_delay`, `retry_exponential_backoff=True`, and `execution_timeout` on every task, plus `dagrun_timeout` on the DAG; alert with `on_failure_callback` to the team's channel.
- **[PERFORMANCE]** Long waits use deferrable operators (`deferrable=True`) or sensors with `mode="reschedule"` and a `timeout`, never a poking sensor that holds a worker slot for hours; limit shared resources with `pools` and `max_active_tis_per_dag`.
- **[PATTERN]** Cross-DAG dependencies use assets: producers declare `outlets=[Asset("s3://lake/curated/orders")]` and consumers use `schedule=[orders_asset]`, instead of `ExternalTaskSensor` chains or time-based guessing.
- **[PATTERN]** Fan-out uses dynamic task mapping (`.expand()`, `.partial()`) with a bounded `max_active_tis_per_dagrun`, not Python loops that generate hundreds of static tasks.
- **[SECURITY]** Connections and secrets come from a secrets backend (Vault, AWS Secrets Manager, GCP Secret Manager) referenced by `conn_id`; never hardcode credentials in DAG files, templates, or environment variables committed to Git, and never log rendered secrets.
- **[PATTERN]** SQL and commands are parameterized (`parameters=` on `SQLExecuteQueryOperator`, Jinja templates for dates), keeping business logic in versioned files under `include/` rather than inline strings.
- **[TESTING]** CI loads every DAG with `DagBag(include_examples=False)` and asserts no `import_errors`, checks required tags, retries, and owners, runs `ruff` with the `AIR` rules, and executes critical DAGs end to end with `dag.test()` against local services.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
