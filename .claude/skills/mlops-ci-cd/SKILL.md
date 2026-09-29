---
name: mlops-ci-cd
description: "CI/CD for machine learning systems: testing code, data, and models separately, training pipelines as code (Kubeflow, Vertex AI Pipelines, SageMaker Pipelines, Airflow, Metaflow), automated retraining triggers, evaluation gates, model registry promotion, reproducible containers, infrastructure as code for ML platforms, and continuous deployment of models with rollback. Use it when automating the path from training code to production models."
---

# Skill: MLOps CI/CD

## Implementation Rules:
- **[ARCHITECTURE]** Treat three artifacts separately with their own pipelines: application and training code (CI on every commit), data (validation on arrival), and models (trained, evaluated, and promoted by an automated training pipeline); link them through versions and lineage.
- **[MANDATORY]** Define training as a pipeline in code (Kubeflow Pipelines, Vertex AI Pipelines, SageMaker Pipelines, Azure ML pipelines, Airflow, or Metaflow) with explicit steps: data extraction by version, validation, feature building, training, evaluation, and registration; notebooks are for exploration only.
- **[MANDATORY]** CI for ML code runs linting and type checks, unit tests for transformations and metrics, data schema tests on fixtures, and a fast smoke-training run on a small sample that verifies the pipeline end to end.
- **[PATTERN]** Build training and serving images reproducibly from lock files with pinned base images and CUDA versions, scan them for vulnerabilities, and reference them by digest in pipeline definitions.
- **[MANDATORY]** Gate promotion automatically: a new model is registered only if data validation passes and the evaluation report meets acceptance criteria (for example, not worse than the champion beyond a tolerance on the primary metric and key slices); human approval is required where risk policy demands it.
- **[PATTERN]** Trigger retraining deliberately: on schedule, on detected data or performance drift, or on new labeled data volume thresholds; record the trigger reason on the run.
- **[PATTERN]** Deploy models with the same practices as software: environment promotion (staging then production), shadow or canary releases with automated rollback, and the previous champion kept ready for instant rollback by alias switch.
- **[FORBIDDEN]** Training production models on developer machines, promoting models without an evaluation report, manual copying of model files to servers, and pipelines that pull `latest` data or images instead of versioned inputs.
- **[SECURITY]** Pipelines run with dedicated service identities with least privilege (read training data, write to the registry), secrets come from a secret manager, and model artifacts are signed or stored in access-controlled registries.
- **[PATTERN]** Manage ML infrastructure (feature stores, registries, endpoints, compute pools, buckets) as code with Terraform or equivalent, with separate environments.
- **[TESTING]** After deployment, run smoke tests with golden examples, monitor online metrics against the offline evaluation, and review pipeline failures and flaky steps as engineering defects.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
