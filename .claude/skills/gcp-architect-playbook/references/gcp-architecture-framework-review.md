# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Opinion-based review
```text
"Orders platform" review (from the design doc):
- Uses GKE, so it is scalable
- Cloud SQL has backups, probably
- Security: IAM is configured
No evidence, no owners, no priorities
```
**Why it's wrong:**
- Statements are assumptions, not facts from the environment, and nothing is actionable.

## Best Practice (How to do it right)

### 1. Evidence from the platform
```bash
# Cloud SQL instances in the production project that are not regional (no HA)
gcloud sql instances list --project=orders-prod \
  --filter='settings.availabilityType!=REGIONAL' \
  --format='table(name, region, settings.availabilityType)'

# Principals with basic roles (owner/editor) on projects in the folder
gcloud asset search-all-iam-policies \
  --scope=folders/123456789012 \
  --query='policy:(roles/owner OR roles/editor)' \
  --format='table(resource, policy.bindings.members)'

# Idle VM recommendations
gcloud recommender recommendations list \
  --project=orders-prod --location=europe-west1-b \
  --recommender=google.compute.instance.IdleResourceRecommender
```
### 2. Findings register
```text
| ID | Pillar      | Finding                                            | Evidence                      | Risk | Recommendation                                         | Owner      |
|----|-------------|----------------------------------------------------|-------------------------------|------|--------------------------------------------------------|------------|
| R1 | Reliability | Cloud SQL orders-db is zonal; RTO target 30 min    | gcloud sql: ZONAL             | High | Enable HA (REGIONAL), test failover quarterly           | team-orders|
| S1 | Security    | 4 users hold roles/editor on orders-prod           | IAM policy search             | High | Replace with predefined roles via groups; org policy   | platform   |
| S2 | Security    | No VPC Service Controls around the BigQuery dataset with customer data | SCC finding | Med | Add perimeter for analytics projects | security |
| C1 | Cost        | 6 idle VMs in orders-dev (about 14% of project cost)| Idle resource recommender     | Low  | Delete or schedule stop                                 | team-orders|
```
**Why it's right:**
- Every finding is backed by platform evidence scoped to the workload.
- Findings are prioritized by risk and assigned to owners with concrete recommendations.
