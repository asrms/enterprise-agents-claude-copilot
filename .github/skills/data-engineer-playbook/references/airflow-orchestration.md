# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Non-idempotent DAG with top-level I/O and data in XCom
```python
from datetime import datetime
import pandas as pd
from airflow.models import Variable
from airflow.decorators import dag, task

API_TOKEN = Variable.get("orders_api_token")             # metadata DB hit on every parse

@dag(schedule_interval="@daily", start_date=datetime(2025, 1, 1))  # deprecated arg, naive date, implicit catchup
def orders_daily():
    @task
    def extract():
        df = pd.read_json(f"https://api.example.com/orders?since={datetime.now():%Y-%m-%d}&token={API_TOKEN}")
        return df.to_dict()                              # whole dataset pushed to XCom

    @task
    def load(rows):
        pd.DataFrame(rows).to_sql("orders", ENGINE, if_exists="append")   # duplicates on retry

    load(extract())

orders_daily()
```
**Why it's wrong:**
- The variable lookup runs at parse time; the token ends up in a URL and in logs.
- `datetime.now()` ties the task to wall-clock time, so retries and backfills load the wrong day; `append` duplicates rows.
- The dataset flows through XCom and the worker's memory; no retries, timeouts, or ownership are configured.

## Best Practice (How to do it right)

### 1. Airflow 3 TaskFlow DAG bound to the data interval
```python
from datetime import timedelta

import pendulum
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from airflow.sdk import Asset, dag, task

CURATED_ORDERS = Asset("s3://lake/curated/orders")

@dag(
    schedule="0 2 * * *",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=timedelta(hours=2),
    tags=["sales", "orders"],
    default_args={
        "owner": "data-platform",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
        "retry_exponential_backoff": True,
        "execution_timeout": timedelta(minutes=30),
    },
)
def orders_daily():
    @task
    def extract_to_lake(data_interval_start=None, data_interval_end=None) -> str:
        from include.orders.extract import export_orders   # heavy imports inside the task

        return export_orders(                           # writes one partition, overwrites on retry
            conn_id="orders_api",
            start=data_interval_start,
            end=data_interval_end,
            target=f"s3://lake/raw/orders/date={data_interval_start:%Y-%m-%d}/",
        )

    merge = SQLExecuteQueryOperator(
        task_id="merge_into_curated",
        conn_id="warehouse",
        sql="include/orders/merge_orders.sql",
        parameters={"start": "{{ data_interval_start }}", "end": "{{ data_interval_end }}"},
        outlets=[CURATED_ORDERS],
    )

    extract_to_lake() >> merge

orders_daily()
```
```python
# tests/test_dag_integrity.py
from airflow.models import DagBag

def test_dags_load_and_follow_conventions():
    bag = DagBag(dag_folder="dags", include_examples=False)
    assert bag.import_errors == {}
    for dag_id, dag in bag.dags.items():
        assert dag.tags, f"{dag_id} has no tags"
        for t in dag.tasks:
            assert t.retries >= 1 and t.execution_timeout, f"{dag_id}.{t.task_id} lacks retries/timeout"
```
**Why it's right:**
- The task reads only its data interval and overwrites one partition; the merge SQL is versioned and parameterized.
- Credentials are resolved from `conn_id` at run time; only a URI travels through XCom.
- The asset outlet lets downstream DAGs schedule on data, and CI rejects DAGs that fail to import or lack retries and timeouts.
