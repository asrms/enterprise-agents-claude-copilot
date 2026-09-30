# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual retraining and deployment
```text
1. Data scientist reruns training.ipynb with the latest export on a laptop GPU
2. Compares the new AUC with a number in a slide from last quarter
3. Copies model.pkl to the serving VM with scp and restarts the service
```
**Why it's wrong:**
- Nothing is versioned or reproducible, the comparison is not like-for-like, and there is no gate or rollback path.
- A production model depends on one person's machine and memory.

## Best Practice (How to do it right)

### 1. Pipeline as code with an evaluation gate (Kubeflow Pipelines v2 SDK)
```python
from kfp import dsl

@dsl.component(base_image="registry.example.com/ml/churn-train@sha256:4f1c...")
def validate_data(data_version: str) -> str: ...

@dsl.component(base_image="registry.example.com/ml/churn-train@sha256:4f1c...")
def train_model(data_version: str, params: dict, model: dsl.Output[dsl.Model]) -> None: ...

@dsl.component(base_image="registry.example.com/ml/churn-train@sha256:4f1c...")
def evaluate(model: dsl.Input[dsl.Model], data_version: str, report: dsl.Output[dsl.Artifact]) -> bool: ...

@dsl.component(base_image="registry.example.com/ml/churn-train@sha256:4f1c...")
def register(model: dsl.Input[dsl.Model], report: dsl.Input[dsl.Artifact], alias: str) -> None: ...

@dsl.pipeline(name="churn-training")
def churn_training(data_version: str, params: dict, trigger_reason: str):
    checked = validate_data(data_version=data_version)
    trained = train_model(data_version=checked.output, params=params)
    evaluated = evaluate(model=trained.outputs["model"], data_version=checked.output)
    with dsl.If(evaluated.outputs["Output"] == True):                          # acceptance criteria met
        register(model=trained.outputs["model"], report=evaluated.outputs["report"], alias="challenger")
```
### 2. CI for the training code
```yaml
jobs:
  ml-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - run: uv sync --locked
      - run: uv run ruff check . && uv run mypy src
      - run: uv run pytest tests/unit tests/data_contracts
      - run: uv run python -m churn.pipeline --smoke --sample-rows 5000   # end-to-end on a tiny sample
```
**Why it's right:**
- Every step runs in a pinned image with versioned data; registration happens only when evaluation passes.
- CI tests code, data contracts, and the whole pipeline quickly on every change; promotion from `challenger` to `champion` is a separate, auditable step.
