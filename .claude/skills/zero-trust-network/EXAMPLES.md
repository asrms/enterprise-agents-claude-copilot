# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Castle-and-moat network
```text
VPN -> 10.0.0.0/8 (all environments reachable once connected)
Security groups: allow 10.0.0.0/8 on all ports between services
Database: public endpoint enabled "for the BI tool", IP allow-list of office ranges
Admin access: shared bastion host, SSH keys copied between engineers since 2021
```
**Why it's wrong:**
- Any compromised laptop or service can reach every system; trust is granted by network location.
- Shared long-lived keys and a public database endpoint provide easy paths for attackers.

## Best Practice (How to do it right)

### 1. Service-to-service mTLS and identity-based authorization (Istio)
```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata: { name: default, namespace: payments }
spec:
  mtls: { mode: STRICT }
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: { name: payments-api, namespace: payments }
spec:
  selector: { matchLabels: { app: payments-api } }
  action: ALLOW
  rules:
    - from:
        - source: { principals: ["cluster.local/ns/orders/sa/orders-api"] }
      to:
        - operation: { methods: ["POST"], paths: ["/v1/payments", "/v1/payments/*/capture"] }
```
### 2. Workforce access through an identity-aware proxy instead of VPN (Terraform, Google Cloud IAP)
```hcl
resource "google_iap_web_backend_service_iam_member" "admin_console" {
  project             = var.project_id
  web_backend_service = google_compute_backend_service.admin_console.name
  role                = "roles/iap.httpsResourceAccessor"
  member              = "group:ops-admins@example.com"

  condition {
    title      = "compliant-device"
    expression = "\"accessPolicies/${var.access_policy_id}/accessLevels/corp_managed_device\" in request.auth.access_levels"
  }
}
```
**Why it's right:**
- Services accept only mutually authenticated traffic, and the payments API allows only the orders service identity for specific operations.
- Administrators reach a single application through an identity-aware proxy, only from compliant managed devices, with no network-wide VPN access.
