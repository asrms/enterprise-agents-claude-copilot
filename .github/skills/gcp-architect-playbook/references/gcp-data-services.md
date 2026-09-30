# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Public, zonal database and unguarded analytics
```text
Cloud SQL orders-db: public IP, authorized network 0.0.0.0/0, ZONAL, backups enabled but PITR off, no deletion protection
Application connects with user "root" and a password in a ConfigMap
BigQuery events table (40 TB) not partitioned; a scheduled report scans it fully every hour
Pub/Sub subscription without dead-letter topic; poison messages retried forever
```
**Why it's wrong:**
- The database is exposed to the internet, cannot survive a zone failure, and cannot be restored to a point in time.
- Analytics costs grow with every query, and messaging failures block consumers indefinitely.

## Best Practice (How to do it right)

### 1. Private, highly available Cloud SQL with PITR and IAM auth (Terraform)
```hcl
resource "google_sql_database_instance" "orders" {
  project             = var.project
  name                = "orders-db"
  region              = "europe-west1"
  database_version    = "POSTGRES_17"
  deletion_protection = true

  settings {
    tier              = "db-custom-4-16384"
    availability_type = "REGIONAL"
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings { retained_backups = 30 }
    }
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
    insights_config { query_insights_enabled = true }
  }
}
```
### 2. Partitioned BigQuery table and Pub/Sub dead-lettering
```hcl
resource "google_bigquery_table" "events" {
  project    = var.project
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "events"
  time_partitioning {
    type  = "DAY"
    field = "event_time"
  }
  require_partition_filter = true
  clustering               = ["tenant_id", "event_type"]
  schema                   = file("${path.module}/schemas/events.json")
}

resource "google_pubsub_subscription" "billing" {
  project = var.project
  name    = "orders-created-billing"
  topic   = google_pubsub_topic.orders_created.id
  ack_deadline_seconds = 60
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.orders_created_dlq.id
    max_delivery_attempts = 10
  }
}
```
**Why it's right:**
- The database has no public IP, requires encrypted connections, is regional with point-in-time recovery, uses IAM authentication, and is protected from deletion.
- Analytics queries must filter on the partition and benefit from clustering; failed messages move to a dead-letter topic after bounded retries.
