---
name: ml-experiment-tracking
description: "Reproducible machine learning experiments: tracking parameters, metrics, artifacts, code version, and data version with MLflow or Weights & Biases, seeding and determinism, environment pinning, dataset versioning with DVC or lakehouse snapshots, model registry stages and aliases, and comparing runs fairly. Use it when setting up or reviewing experiment tracking and model lineage."
---

# Skill: ML Experiment Tracking

## Implementation Rules:
- **[MANDATORY]** Every training run is tracked in an experiment tracker (MLflow Tracking, Weights & Biases, or a managed equivalent) with parameters, metrics per step and final, artifacts (model, plots, confusion matrices), the Git commit, and the dataset version; runs that are not tracked do not produce candidate models.
- **[MANDATORY]** Pin data versions: training data is referenced by an immutable identifier (DVC-tracked files, Iceberg/Delta snapshot or version, dataset hash) logged with the run, so any model can be traced to the exact data it was trained on.
- **[PATTERN]** Pin the environment: dependency lock files (`uv.lock`, `poetry.lock`, `conda-lock`), a container image digest for training jobs, and hardware details (GPU type, CUDA version) logged as run tags.
- **[PATTERN]** Control randomness: set seeds for Python, NumPy, and the framework (`torch.manual_seed`, `torch.cuda.manual_seed_all`), log them, and enable deterministic algorithms where reproducibility matters more than speed; report variance across several seeds for important comparisons.
- **[PATTERN]** Organize runs by experiment (one question or model family per experiment), use consistent metric names and units, and tag runs with purpose (`baseline`, `ablation`, `hpo`) and owner.
- **[PATTERN]** Run hyperparameter searches with a tool that logs every trial (Optuna, Ray Tune, W&B Sweeps) and use a fixed validation protocol; select models on validation data and report final results once on a held-out test set.
- **[MANDATORY]** Register candidate models in a model registry (MLflow Model Registry with aliases such as `champion`/`challenger`, or an equivalent) with the model signature, input example, evaluation report, and lineage to the run; promotion requires recorded approval.
- **[FORBIDDEN]** Selecting models by test-set performance, overwriting artifacts of past runs, logging secrets or raw personal data as parameters or artifacts, and notebooks as the only record of how a model was produced.
- **[SECURITY]** The tracking server and artifact store require authentication, artifacts are stored in access-controlled buckets with encryption, and access follows the classification of the training data.
- **[PERFORMANCE]** Log efficiently: aggregate step metrics at a sensible frequency, store large artifacts in object storage, and clean up abandoned runs with retention policies.
- **[TESTING]** Training code is covered by unit tests (data transforms, loss functions, metric computations) and a smoke training run on a tiny dataset in CI that checks the tracking integration and that loss decreases.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
