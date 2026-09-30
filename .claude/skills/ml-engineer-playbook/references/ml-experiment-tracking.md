# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Untracked notebook training
```python
df = pd.read_csv("s3://ml-data/churn/latest.csv")          # "latest": changes every day
X_train, X_test, y_train, y_test = train_test_split(df.drop(columns="churned"), df["churned"])
model = GradientBoostingClassifier(n_estimators=300).fit(X_train, y_train)
print(roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]))   # tuned repeatedly against this score
pickle.dump(model, open("model_final_v3_really_final.pkl", "wb"))
```
**Why it's wrong:**
- No record of data version, parameters, code, or environment; the split is random and unseeded.
- The test set is used for model selection, so the reported score is optimistic, and the artifact has no lineage.

## Best Practice (How to do it right)

### 1. Tracked, versioned, reproducible run with MLflow
```python
import mlflow
from mlflow.models import infer_signature

SEED = 20260929
DATA_VERSION = "churn_features@v42"                         # immutable table version or DVC revision

def train(params: dict) -> None:
    np.random.seed(SEED)
    train_df, valid_df = load_split(DATA_VERSION, split=("train", "valid"))   # fixed, time-based split

    mlflow.set_experiment("churn-gbm")
    with mlflow.start_run(run_name="gbm-depth-sweep") as run:
        mlflow.set_tags({"git_commit": git_sha(), "data_version": DATA_VERSION, "purpose": "hpo", "owner": "team-ml"})
        mlflow.log_params({**params, "seed": SEED})

        model = HistGradientBoostingClassifier(random_state=SEED, **params)
        model.fit(train_df[FEATURES], train_df[TARGET])

        proba = model.predict_proba(valid_df[FEATURES])[:, 1]
        mlflow.log_metrics({
            "valid_roc_auc": roc_auc_score(valid_df[TARGET], proba),
            "valid_pr_auc": average_precision_score(valid_df[TARGET], proba),
        })

        signature = infer_signature(valid_df[FEATURES].head(100), proba[:100])
        mlflow.sklearn.log_model(
            model, name="model", signature=signature, input_example=valid_df[FEATURES].head(5),
            registered_model_name="churn-classifier",
        )
```
```python
# promotion after review of the evaluation report
client = mlflow.MlflowClient()
client.set_registered_model_alias("churn-classifier", "challenger", version="17")
```
**Why it's right:**
- Data version, code commit, parameters, seed, metrics, and the model with its signature are all recorded together.
- Selection uses a validation split; the test set is reserved for the final evaluation report.
- The registry holds versions with aliases, so serving references `challenger` or `champion` rather than file names.
