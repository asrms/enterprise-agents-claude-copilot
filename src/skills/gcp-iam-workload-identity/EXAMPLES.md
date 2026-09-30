# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Keys and basic roles
```bash
gcloud iam service-accounts keys create key.json --iam-account=deployer@orders-prod.iam.gserviceaccount.com
# key.json stored as a CI secret, valid indefinitely
gcloud projects add-iam-policy-binding orders-prod --member=serviceAccount:deployer@orders-prod.iam.gserviceaccount.com --role=roles/editor
gcloud projects add-iam-policy-binding orders-prod --member=user:dev1@example.com --role=roles/owner
```
**Why it's wrong:**
- A long-lived key can leak from CI and grants Editor on the whole project.
- Individual users hold Owner, bypassing group management and least privilege.

## Best Practice (How to do it right)

### 1. Workload Identity Federation for GitHub Actions (Terraform)
```hcl
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.cicd_project
  workload_identity_pool_id = "github"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.cicd_project
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  attribute_mapping = {
    "google.subject"         = "assertion.sub"
    "attribute.repository"   = "assertion.repository"
    "attribute.repo_env"     = "assertion.repository + ':' + (has(assertion.environment) ? assertion.environment : 'none')"
  }
  attribute_condition = "assertion.repository_owner == 'acme'"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

resource "google_service_account" "orders_deployer" {
  project    = var.prod_project
  account_id = "orders-deployer"
}

resource "google_service_account_iam_member" "wif_prod_only" {
  service_account_id = google_service_account.orders_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repo_env/acme/orders:production"
}
```
### 2. Narrow, conditional grants
```hcl
resource "google_storage_bucket_iam_member" "orders_exports_writer" {
  bucket = google_storage_bucket.exports.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.orders_api.email}"
}

resource "google_project_iam_member" "oncall_temporary_sql_admin" {
  project = var.prod_project
  role    = "roles/cloudsql.admin"
  member  = "group:orders-oncall@example.com"
  condition {
    title      = "expires-after-incident"
    expression = "request.time < timestamp('2026-10-01T00:00:00Z')"
  }
}
```
**Why it's right:**
- CI obtains short-lived credentials through federation, restricted to the organization's repositories, and only the orders repository's production environment can impersonate the deployer; no keys exist.
- The workload writes only to one bucket, and elevated access for on-call is time-bound by an IAM Condition.
