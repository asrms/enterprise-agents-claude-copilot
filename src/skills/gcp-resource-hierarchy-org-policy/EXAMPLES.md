# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Flat, manually managed organization
```text
Organization example.com
├── project "prod-stuff" (created by hand, 3 teams, Owner granted to 12 users)
├── project "test-2023", "john-playground", "migration-temp" (no labels, no owners)
└── no organization policies: service account keys allowed, public buckets allowed, VMs with external IPs everywhere
Audit logs: default retention in each project, Data Access logs disabled
```
**Why it's wrong:**
- There is no isolation, inheritance, or guardrail; anyone can create keys and public resources.
- Logs and costs cannot be governed centrally, and unowned projects accumulate risk and spend.

## Best Practice (How to do it right)

### 1. Folders and guardrails as code (Terraform)
```hcl
resource "google_folder" "production" {
  display_name = "production"
  parent       = "organizations/${var.org_id}"
}

resource "google_org_policy_policy" "disable_sa_keys" {
  name   = "organizations/${var.org_id}/policies/iam.disableServiceAccountKeyCreation"
  parent = "organizations/${var.org_id}"
  spec {
    rules { enforce = "TRUE" }
  }
}

resource "google_org_policy_policy" "public_access_prevention" {
  name   = "organizations/${var.org_id}/policies/storage.publicAccessPrevention"
  parent = "organizations/${var.org_id}"
  spec {
    rules { enforce = "TRUE" }
  }
}

resource "google_org_policy_policy" "allowed_locations" {
  name   = "${google_folder.production.name}/policies/gcp.resourceLocations"
  parent = google_folder.production.name
  spec {
    rules {
      values { allowed_values = ["in:eu-locations"] }
    }
  }
}
```
### 2. Organization-level log sink to a locked bucket
```hcl
resource "google_logging_organization_sink" "audit" {
  name             = "org-audit-logs"
  org_id           = var.org_id
  include_children = true
  destination      = "logging.googleapis.com/projects/${var.logging_project}/locations/eu/buckets/org-audit"
  filter           = "logName:\"cloudaudit.googleapis.com\""
}

resource "google_logging_project_bucket_config" "org_audit" {
  project        = var.logging_project
  location       = "eu"
  bucket_id      = "org-audit"
  retention_days = 400
  locked         = true
}
```
**Why it's right:**
- Guardrails are inherited by every project: no service account keys, no public buckets, and EU-only locations in production.
- All audit logs flow to a central, locked bucket that project owners cannot alter, and the whole foundation is code.
