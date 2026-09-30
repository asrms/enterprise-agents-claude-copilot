# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. No allocation, no controls
```text
One project "company-prod" for all teams; 60% of resources without labels
No billing export; the invoice is the only cost report
Dashboard queries run SELECT * on a 30 TB unpartitioned BigQuery table every 15 minutes
Dev GKE clusters with 12 n2-standard-8 nodes running at 5% utilization, 24/7
```
**Why it's wrong:**
- Costs cannot be attributed or analyzed, and nothing alerts before the invoice arrives.
- Unbounded BigQuery scans and idle clusters generate large, avoidable spend.

## Best Practice (How to do it right)

### 1. Budget with alerts and Pub/Sub notifications (Terraform)
```hcl
resource "google_billing_budget" "orders_prod" {
  billing_account = var.billing_account
  display_name    = "orders-prod-monthly"

  budget_filter {
    projects = ["projects/${var.orders_prod_project_number}"]
  }
  amount {
    specified_amount {
      currency_code = "EUR"
      units         = "9000"
    }
  }
  threshold_rules { threshold_percent = 0.8 }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }
  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.budget_alerts.id
    monitoring_notification_channels = [google_monitoring_notification_channel.orders_owners.id]
  }
}
```
### 2. Query cost guardrail from an application (Python)
```python
from google.cloud import bigquery

client = bigquery.Client()
job_config = bigquery.QueryJobConfig(
    maximum_bytes_billed=50 * 1024**3,                     # fail instead of scanning more than 50 GiB
    labels={"app": "orders-reporting", "cost-center": "sales"},
)
sql = """
SELECT tenant_id, COUNT(*) AS orders
FROM analytics.events
WHERE event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)   -- partition filter
  AND event_type = 'order_created'
GROUP BY tenant_id
"""
rows = client.query(sql, job_config=job_config).result()
```
### 3. Cost per service from the billing export
```sql
SELECT service.description AS service,
       (SELECT value FROM UNNEST(labels) WHERE key = 'app') AS app,
       ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)), 2) AS net_cost
FROM `billing_export.gcp_billing_export_resource_v1_XXXXXX`
WHERE invoice.month = '202609'
GROUP BY service, app
ORDER BY net_cost DESC;
```
**Why it's right:**
- Owners are alerted on actual and forecasted spend, and notifications can trigger automation.
- Application queries are bounded and labeled for attribution; costs are analyzed per service and application including credits.
