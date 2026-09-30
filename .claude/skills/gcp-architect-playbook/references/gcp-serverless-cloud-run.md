# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Public service with default identity and plaintext secret
```bash
gcloud run deploy orders-api \
  --image=gcr.io/orders-prod/orders-api:latest \
  --allow-unauthenticated \
  --set-env-vars=DB_PASSWORD=Orders2026! \
  --max-instances=1000
# runs as the default compute service account (Editor on the project)
```
**Why it's wrong:**
- An internal API is public, runs with project-wide Editor rights, and exposes a database password in its configuration.
- Up to 1,000 instances can overwhelm the database; `latest` makes deployments untraceable.

## Best Practice (How to do it right)

### 1. Cloud Run service with dedicated identity, secrets, private networking, and traffic split (Terraform)
```hcl
resource "google_service_account" "orders_api" {
  project    = var.project
  account_id = "orders-api"
}

resource "google_cloud_run_v2_service" "orders_api" {
  project  = var.project
  name     = "orders-api"
  location = "europe-west1"
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account                  = google_service_account.orders_api.email
    max_instance_request_concurrency = 40
    scaling {
      min_instance_count = 1
      max_instance_count = 30                        # sized to database connection limits
    }
    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = var.network
        subnetwork = var.subnetwork
      }
    }
    containers {
      image = "europe-west1-docker.pkg.dev/orders-prod/apps/orders-api@${var.image_digest}"
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        startup_cpu_boost = true
      }
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.orders_db.secret_id
            version = "3"
          }
        }
      }
      startup_probe {
        http_get { path = "/readyz" }
      }
    }
  }

  traffic {
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"
    revision = var.stable_revision
    percent  = 90
  }
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 10
  }
}

resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  project  = var.project
  location = google_cloud_run_v2_service.orders_api.location
  name     = google_cloud_run_v2_service.orders_api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.gateway_service_account}"
}
```
**Why it's right:**
- The service has its own identity, reads a pinned secret version from Secret Manager, and is reachable only through the internal load balancer by an authorized caller.
- Scaling is bounded to protect the database, startup is optimized, egress to private ranges uses Direct VPC egress, and new revisions receive a small share of traffic first.
