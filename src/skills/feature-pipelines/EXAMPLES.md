# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Leaky join and duplicated transformation logic
```python
# training: joins the CURRENT customer aggregates to historical labels
train = labels.merge(customer_stats, on="customer_id")          # includes purchases after the label date
train["amount_scaled"] = (train.amount - train.amount.mean()) / train.amount.std()   # stats from all data

# serving (another repository, rewritten by hand)
features["amount_scaled"] = (amount - 52.1) / 18.7               # constants copied from a notebook
```
**Why it's wrong:**
- Features include information from after the prediction time, so offline metrics are inflated and production performance drops.
- Scaling is fitted on all data and reimplemented differently at serving time, causing training-serving skew.

## Best Practice (How to do it right)

### 1. Feature definitions and point-in-time retrieval (Feast)
```python
from datetime import timedelta
from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, Int64

customer = Entity(name="customer", join_keys=["customer_id"])

customer_stats_source = FileSource(
    path="s3://ml-features/customer_stats/", timestamp_field="event_timestamp",
)

customer_stats = FeatureView(
    name="customer_stats_30d",
    entities=[customer],
    ttl=timedelta(days=2),
    schema=[
        Field(name="orders_30d", dtype=Int64),
        Field(name="spend_30d", dtype=Float32),
        Field(name="days_since_last_order", dtype=Int64),
    ],
    source=customer_stats_source,
    owner="team-ml@example.com",
    tags={"domain": "sales"},
)
```
```python
# training set: labels carry the prediction timestamp; Feast joins feature values as of that time
training_df = store.get_historical_features(
    entity_df=labels[["customer_id", "event_timestamp", "churned"]],
    features=["customer_stats_30d:orders_30d", "customer_stats_30d:spend_30d",
              "customer_stats_30d:days_since_last_order"],
).to_df()

# serving: the same feature view, read from the online store
online = store.get_online_features(
    features=["customer_stats_30d:orders_30d", "customer_stats_30d:spend_30d",
              "customer_stats_30d:days_since_last_order"],
    entity_rows=[{"customer_id": "c-1042"}],
).to_dict()
```
### 2. Preprocessing shipped with the model
```python
pipeline = Pipeline([
    ("prep", ColumnTransformer([("num", StandardScaler(), NUMERIC), ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL)])),
    ("clf", HistGradientBoostingClassifier(random_state=SEED)),
])
pipeline.fit(train_df[NUMERIC + CATEGORICAL], train_df["churned"])   # scaler fitted on training data only
```
**Why it's right:**
- Training data is assembled with point-in-time correct joins, and the same feature definitions serve online requests.
- Preprocessing is fitted on training data only and packaged with the model, eliminating hand-copied constants.
