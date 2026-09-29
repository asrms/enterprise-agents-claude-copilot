# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Python UDF, driver collect, and tiny appended files
```python
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

@F.udf(StringType())                                    # row-at-a-time Python, no optimization
def normalize_country(code):
    return code.strip().upper() if code else None

orders = spark.read.json("s3://lake/raw/orders/")       # schema inference on every run
countries = orders.select("country").distinct().collect()   # pulls data to the driver
for row in countries:                                   # one job per country
    (orders.filter(F.col("country") == row.country)
        .withColumn("country", normalize_country("country"))
        .join(spark.table("dim_customer"), "customer_id")   # no pruning, possible shuffle of both sides
        .write.mode("append")                           # duplicates on retry
        .parquet(f"s3://lake/curated/orders/{row.country}"))
```
**Why it's wrong:**
- The UDF serializes every row to Python; the driver loop launches one job per key and rereads the input each time.
- `append` makes retries produce duplicates, and small per-key writes produce many tiny files.
- JSON inference and full-width reads waste I/O; the join ignores that the dimension is small.

## Best Practice (How to do it right)

### 1. Built-in functions, broadcast join, idempotent partitioned write
```python
from pyspark.sql import DataFrame, SparkSession, functions as F

def curate_orders(orders: DataFrame, customers: DataFrame) -> DataFrame:
    return (
        orders.select("order_id", "customer_id", "country", "amount", "order_date")
        .withColumn("country", F.upper(F.trim("country")))
        .join(F.broadcast(customers.select("customer_id", "segment")), "customer_id", "left")
    )

def run(spark: SparkSession, day: str) -> None:
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
    orders = spark.table("raw.orders").where(F.col("order_date") == F.lit(day))  # partition pruning
    customers = spark.table("curated.dim_customer")
    (curate_orders(orders, customers)
        .repartition("order_date")
        .writeTo("curated.orders")
        .overwritePartitions())                           # rerun-safe
```
```python
# tests/test_curate_orders.py
from pyspark.testing import assertDataFrameEqual

def test_curate_orders_normalizes_country_and_keeps_unknown_customers(spark):
    orders = spark.createDataFrame(
        [("o1", "c1", " it ", 10.0, "2026-09-28"), ("o2", "c9", "de", 5.0, "2026-09-28")],
        "order_id string, customer_id string, country string, amount double, order_date string")
    customers = spark.createDataFrame([("c1", "retail")], "customer_id string, segment string")
    expected = spark.createDataFrame(
        [("c1", "o1", "IT", 10.0, "2026-09-28", "retail"), ("c9", "o2", "DE", 5.0, "2026-09-28", None)],
        "customer_id string, order_id string, country string, amount double, order_date string, segment string")
    assertDataFrameEqual(curate_orders(orders, customers), expected)
```
**Why it's right:**
- Built-in functions stay in the JVM and are optimized by Catalyst; the small dimension is broadcast, avoiding a shuffle.
- Reading one partition prunes input, and dynamic partition overwrite through `writeTo(...).overwritePartitions()` makes retries safe.
- The transformation is a pure function tested with `assertDataFrameEqual`, including a missing customer.
