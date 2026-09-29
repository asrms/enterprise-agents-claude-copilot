# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Only uptime checks and blind retraining
```text
Monitoring: HTTP 200 rate and CPU of the churn endpoint
Retraining: cron every Sunday on whatever data exists
Incident: upstream renamed plan "standard" -> "std"; model saw an unseen category for 5 weeks,
          scores collapsed for 40% of users, nobody noticed; Sunday retraining learned from the broken data
```
**Why it's wrong:**
- Infrastructure metrics stay green while predictions degrade.
- Automatic retraining without data validation bakes the upstream bug into the next model.

## Best Practice (How to do it right)

### 1. Daily drift report with Evidently and action-mapped alerts
```python
from evidently import Report
from evidently.presets import DataDriftPreset, DataSummaryPreset

reference = load_predictions(window=("2026-07-01", "2026-07-31"))      # stable reference period
current = load_predictions(window=(yesterday, today))

report = Report([DataDriftPreset(), DataSummaryPreset()])
result = report.run(reference_data=reference[FEATURES + ["score"]], current_data=current[FEATURES + ["score"]])
result.save_html(f"reports/churn/{today}.html")

drift = compute_psi(reference, current, columns=TOP_FEATURES + ["score"])  # population stability index per column
missing = current[FEATURES].isna().mean()

alerts = []
if (drift > 0.25).any():
    alerts.append(("major_drift", drift[drift > 0.25].to_dict(), "runbook#investigate-upstream"))
if (missing > 0.05).any():
    alerts.append(("missing_features", missing[missing > 0.05].to_dict(), "runbook#data-quality"))
if len(current) < 500:
    alerts.append(("low_volume", {"rows": len(current)}, "runbook#traffic"))
send_alerts(team="team-ml", alerts=alerts)
```
### 2. Delayed ground truth joined to logged predictions
```sql
SELECT date_trunc('week', p.predicted_at)              AS week,
       p.model_version,
       p.region,
       count(*)                                        AS predictions,
       avg(CASE WHEN l.churned THEN 1.0 ELSE 0.0 END)  AS observed_churn_rate,
       avg(p.score)                                    AS mean_predicted_score
FROM   ml.churn_predictions p
JOIN   ml.churn_labels l ON l.customer_id = p.customer_id
                        AND l.label_date BETWEEN p.predicted_at AND p.predicted_at + INTERVAL '30 days'
GROUP  BY 1, 2, 3;
```
**Why it's right:**
- Drift and data quality are checked daily against a reference, with thresholds linked to runbook actions and minimum sample sizes.
- Real outcomes are tracked per model version and region once labels arrive, validating calibration over time.
