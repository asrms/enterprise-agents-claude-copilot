---
name: model-evaluation
description: "Rigorous evaluation of machine learning models: correct data splits (time-based, grouped, stratified), metrics aligned with the business objective, baselines, calibration, threshold selection with costs, confidence intervals, slice-based and fairness analysis, offline-online gaps, and evaluation reports that gate promotion. Use it when evaluating, comparing, or approving models."
---

# Skill: Model Evaluation

## Implementation Rules:
- **[MANDATORY]** Split data to mirror production: time-based splits for anything forecasted or time-dependent, grouped splits (`GroupKFold`) when rows share an entity (customer, patient, device), and stratification for rare classes; the test set is locked and used once for the final report.
- **[MANDATORY]** Choose metrics from the decision the model supports: PR-AUC, recall at fixed precision, or expected cost for imbalanced classification; calibrated probabilities (Brier score, reliability curves) when scores drive decisions; MAE/MAPE/quantile loss for forecasts; NDCG or recall@k for ranking. Accuracy alone is not an acceptable headline metric for imbalanced problems.
- **[MANDATORY]** Always compare against baselines: a trivial baseline (majority class, last value, popularity) and the current production model (champion), evaluated on the same data.
- **[PATTERN]** Report uncertainty: confidence intervals via bootstrapping or cross-validation spread, and statistical tests for champion-challenger comparisons; small differences within noise are not improvements.
- **[PATTERN]** Select decision thresholds with the business costs of false positives and false negatives, or capacity constraints (for example, the number of cases a team can review per day), and document the chosen operating point.
- **[PATTERN]** Evaluate by slices: segments such as region, device, customer tier, new vs returning users, and protected attributes where legally appropriate; flag slices whose performance falls below agreed thresholds.
- **[SECURITY]** Assess fairness and harm for models affecting people: compare error rates across groups (equalized odds, demographic parity differences as appropriate), document limitations in a model card, and involve domain and legal stakeholders for high-risk use cases.
- **[FORBIDDEN]** Tuning on the test set, data leakage between splits (duplicates, shared entities, future information), reporting only the best seed, and comparing models evaluated on different data or preprocessing.
- **[PATTERN]** Check robustness: performance under missing features, out-of-range values, and recent data (a backtest on the latest period), plus error analysis of the worst mistakes with examples.
- **[MANDATORY]** Produce an evaluation report per candidate (data versions, metrics with intervals, slices, calibration, threshold, comparison to champion, known limitations) attached to the model registry entry; promotion requires meeting pre-agreed acceptance criteria.
- **[TESTING]** Automate evaluation as a pipeline step with fixed seeds and versioned evaluation datasets, fail it when acceptance criteria are not met, and validate the offline results with an online test (shadow, canary, or A/B test) before full rollout.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
