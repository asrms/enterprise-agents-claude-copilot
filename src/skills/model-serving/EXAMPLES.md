# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Model loaded per request from an untrusted pickle
```python
@app.post("/predict")
def predict(payload: dict):
    model = pickle.load(open("/models/latest.pkl", "rb"))       # loads on every call; arbitrary code execution risk
    return {"score": model.predict_proba([list(payload.values())])[0][1]}   # unvalidated, order-dependent input
```
**Why it's wrong:**
- Loading per request adds latency, and unpickling untrusted files can execute arbitrary code.
- Input is not validated or ordered by name; responses carry no model version, so predictions cannot be traced.

## Best Practice (How to do it right)

### 1. FastAPI service with registry-loaded model, validation, and observability
```python
from contextlib import asynccontextmanager
from typing import Literal

import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
import mlflow

MODEL_URI = "models:/churn-classifier@champion"   # logged with pyfunc_predict_fn="predict_proba"

class ChurnFeatures(BaseModel):
    orders_30d: int = Field(ge=0, le=10_000)
    spend_30d: float = Field(ge=0, le=1_000_000)
    days_since_last_order: int = Field(ge=0, le=3650)
    plan: Literal["free", "standard", "premium"]

class ChurnPrediction(BaseModel):
    churn_probability: float
    model_version: str

state: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    state["model"] = mlflow.pyfunc.load_model(MODEL_URI)             # once at startup
    state["version"] = state["model"].metadata.run_id
    state["model"].predict(pd.DataFrame([WARMUP_ROW]))                # warm up before readiness
    yield

app = FastAPI(lifespan=lifespan)

@app.post("/v1/churn:predict", response_model=ChurnPrediction)
def predict(features: ChurnFeatures) -> ChurnPrediction:
    frame = pd.DataFrame([features.model_dump()])
    proba = float(state["model"].predict(frame)[0][1])            # probability of the positive class
    PREDICTIONS.labels(model_version=state["version"]).inc()
    logger.info("prediction", extra={"model_version": state["version"], "score": proba})
    return ChurnPrediction(churn_probability=proba, model_version=state["version"])
```
### 2. Canary rollout with KServe
```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: churn-classifier
spec:
  predictor:
    canaryTrafficPercent: 10
    minReplicas: 2
    model:
      modelFormat: { name: mlflow }
      protocolVersion: v2
      storageUri: s3://ml-models/churn-classifier/versions/18
      resources:
        requests: { cpu: "1", memory: 2Gi }
        limits: { memory: 2Gi }
```
**Why it's right:**
- The model is loaded once from the registry by alias, warmed up, and every response carries the model version.
- Inputs are validated with explicit ranges and names; metrics and logs support monitoring.
- New versions receive 10% of traffic first, with at least two replicas for availability.
