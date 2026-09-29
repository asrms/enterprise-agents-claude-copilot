---
name: model-monitoring-drift
description: "Monitoring machine learning models in production: service health, prediction and feature distribution drift (PSI, KS, Jensen-Shannon), data quality of inputs, delayed ground truth and performance tracking, concept drift, segment-level monitoring, alert thresholds tied to actions, retraining triggers, and tooling such as Evidently, whylogs, or managed model monitoring. Use it when setting up or reviewing model monitoring."
---

# Skill: Model Monitoring and Drift

## Implementation Rules:
- **[ARCHITECTURE]** Monitor models on four layers: service health (latency, errors, throughput), input data quality (schema, missing values, ranges), distributions (feature and prediction drift), and outcome quality (model metrics once labels arrive, plus business KPIs).
- **[MANDATORY]** Log every prediction with model version, timestamp, request id, features used (or references to them), and the prediction, so outcomes can be joined later and drift can be computed; apply the same privacy controls as for the source data.
- **[PATTERN]** Measure drift against a reference window (training data or a stable production period) with appropriate statistics: PSI or Jensen-Shannon divergence for binned or categorical features, Kolmogorov-Smirnov or Wasserstein distance for continuous features, and prediction score distribution shift.
- **[PATTERN]** Prioritize features by importance when alerting on drift, and monitor segments (region, device, customer tier) because aggregate metrics can hide local degradation.
- **[MANDATORY]** Track real performance when ground truth arrives (often delayed): join labels to logged predictions, compute the same metrics as the offline evaluation, and use proxy metrics (acceptance rates, overrides, complaint rates) in the meantime.
- **[MANDATORY]** Every alert maps to an action in a runbook: investigate upstream data changes, fall back to a rule-based policy or the previous model, trigger retraining, or accept the change and update the reference; thresholds are tuned to avoid alert fatigue.
- **[FORBIDDEN]** Retraining automatically on every drift alert without validation (drift can be caused by broken upstream data), monitoring only infrastructure metrics, and comparing distributions across windows with too few samples to be meaningful.
- **[PATTERN]** Detect upstream data issues early with data contracts and validation at feature pipelines; many "model drift" incidents are schema changes, unit changes, or missing data.
- **[PERFORMANCE]** Compute drift reports in batch on windows (hourly or daily) with profiling libraries (Evidently, whylogs) or managed services (SageMaker Model Monitor, Vertex AI Model Monitoring, Azure ML data drift), and store profiles for trend analysis rather than raw payloads indefinitely.
- **[SECURITY]** Watch for abuse and adversarial behavior on exposed models (unusual input patterns, probing), and ensure monitoring stores respect retention and access policies for personal data.
- **[TESTING]** Test the monitoring itself: inject synthetic drift and broken data into a staging stream and verify that the right alerts fire and route to the owning team.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
