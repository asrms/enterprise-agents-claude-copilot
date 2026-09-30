# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Random split, accuracy, no baseline
```python
X_train, X_test, y_train, y_test = train_test_split(X, y)          # same customers on both sides, future leaks into train
model.fit(X_train, y_train)
print("accuracy", accuracy_score(y_test, model.predict(X_test)))   # 97% on a 3% fraud rate: meaningless
```
**Why it's wrong:**
- Rows of the same customer and later time periods leak into training, inflating the score.
- Accuracy on a 3% positive rate is dominated by the majority class; there is no baseline or champion comparison.

## Best Practice (How to do it right)

### 1. Time-based split, cost-aware threshold, intervals, and slices
```python
train = df[df.event_time < "2026-06-01"]
valid = df[(df.event_time >= "2026-06-01") & (df.event_time < "2026-08-01")]
test = df[df.event_time >= "2026-08-01"]                             # touched once, for the final report

model.fit(train[FEATURES], train[TARGET])
p_valid = model.predict_proba(valid[FEATURES])[:, 1]

COST_FN, COST_FP = 120.0, 4.0                                        # missed fraud vs manual review cost
thresholds = np.linspace(0.01, 0.99, 99)
costs = [COST_FN * ((p_valid < t) & (valid[TARGET] == 1)).sum() + COST_FP * ((p_valid >= t) & (valid[TARGET] == 0)).sum()
         for t in thresholds]
threshold = thresholds[int(np.argmin(costs))]

def bootstrap_ci(y, p, metric, n=1000, seed=7):
    rng = np.random.default_rng(seed)
    idx = [rng.integers(0, len(y), len(y)) for _ in range(n)]
    scores = [metric(y.iloc[i], p[i]) for i in idx]
    return np.percentile(scores, [2.5, 97.5])

p_test = model.predict_proba(test[FEATURES])[:, 1]
p_champion = champion.predict_proba(test[FEATURES])[:, 1]
report = {
    "pr_auc": average_precision_score(test[TARGET], p_test),
    "pr_auc_ci95": bootstrap_ci(test[TARGET], p_test, average_precision_score).tolist(),
    "champion_pr_auc": average_precision_score(test[TARGET], p_champion),
    "baseline_pr_auc": test[TARGET].mean(),                          # random classifier baseline
    "brier": brier_score_loss(test[TARGET], p_test),
    "threshold": float(threshold),
    "recall_at_threshold": recall_score(test[TARGET], p_test >= threshold),
    "slices": {
        region: average_precision_score(g[TARGET], model.predict_proba(g[FEATURES])[:, 1])
        for region, g in test.groupby("region") if g[TARGET].nunique() == 2
    },
}
mlflow.log_dict(report, "evaluation/report.json")
```
**Why it's right:**
- The split mirrors production time order, and the test set is used once.
- The metric fits the imbalanced problem, the threshold reflects business costs, and results carry confidence intervals.
- The candidate is compared to the champion and a baseline, and performance is broken down by slice in a stored report.
