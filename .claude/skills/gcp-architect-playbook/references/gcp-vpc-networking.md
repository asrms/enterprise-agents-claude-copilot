# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Default network with open firewall rules
```text
Project orders-prod uses the "default" auto-mode network
Firewall: default-allow-ssh 0.0.0.0/0:22, default-allow-rdp 0.0.0.0/0:3389, allow-all-internal
VMs with external IPs; Cloud SQL with public IP and authorized network 0.0.0.0/0
BigQuery dataset with customer data readable from any network by anyone holding credentials
```
**Why it's wrong:**
- Management ports and the database are exposed to the internet, and the auto-mode network overlaps with other VPCs.
- Stolen credentials can exfiltrate sensitive data from anywhere without a perimeter.

## Best Practice (How to do it right)

### 1. Custom VPC, hierarchical firewall for IAP, Cloud NAT (Terraform)
```hcl
resource "google_compute_network" "prod" {
  project                 = var.host_project
  name                    = "vpc-prod"
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}

resource "google_compute_subnetwork" "app_ew1" {
  project                  = var.host_project
  name                     = "sn-prod-app-ew1"
  region                   = "europe-west1"
  network                  = google_compute_network.prod.id
  ip_cidr_range            = "10.20.0.0/20"
  private_ip_google_access = true
  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.64.0.0/14"
  }
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
  }
}

resource "google_compute_firewall_policy" "org_baseline" {
  parent     = "folders/${var.production_folder_id}"
  short_name = "prod-baseline"
}

resource "google_compute_firewall_policy_rule" "allow_iap_ssh" {
  firewall_policy = google_compute_firewall_policy.org_baseline.id
  priority        = 1000
  direction       = "INGRESS"
  action          = "allow"
  match {
    src_ip_ranges = ["35.235.240.0/20"]            # Identity-Aware Proxy TCP forwarding range
    layer4_configs {
      ip_protocol = "tcp"
      ports       = ["22"]
    }
  }
}

resource "google_compute_router_nat" "ew1" {
  project                            = var.host_project
  name                               = "nat-prod-ew1"
  router                             = google_compute_router.ew1.name
  region                             = "europe-west1"
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
```
### 2. VPC Service Controls perimeter (dry run first)
```hcl
resource "google_access_context_manager_service_perimeter" "analytics" {
  parent = "accessPolicies/${var.access_policy}"
  name   = "accessPolicies/${var.access_policy}/servicePerimeters/analytics"
  title  = "analytics"
  use_explicit_dry_run_spec = true
  spec {
    resources           = ["projects/${var.analytics_project_number}"]
    restricted_services = ["bigquery.googleapis.com", "storage.googleapis.com"]
  }
}
```
**Why it's right:**
- The VPC is custom with flow logs and Private Google Access; SSH is allowed only from IAP, and egress goes through Cloud NAT.
- The analytics project is placed in a VPC Service Controls perimeter in dry-run mode before enforcement.
