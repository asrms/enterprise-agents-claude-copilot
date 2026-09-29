# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Checklist review without evidence or priorities
```text
Review of "Claims Portal" (from the architecture slide deck):
- Reliability: uses App Service, looks fine
- Security: HTTPS enabled
- Cost: could maybe use reservations
No owners, no risk ratings, no follow-up date
```
**Why it's wrong:**
- Findings are opinions based on slides, not the deployed configuration, and are not tied to requirements.
- Nothing is prioritized or owned, so nothing changes.

## Best Practice (How to do it right)

### 1. Evidence gathering with Azure Resource Graph
```kusto
// Resources in the workload's subscriptions that are not zone-redundant or expose public network access
resources
| where subscriptionId in ('<sub-prod-claims>')
| extend publicAccess = tostring(properties.publicNetworkAccess)
| extend zones = zones
| project name, type, location, sku = tostring(sku.name), publicAccess, zones
| where publicAccess =~ 'Enabled' or isnull(zones)
| order by type asc
```
```bash
az advisor recommendation list --category HighAvailability --query "[].{resource:impactedValue, problem:shortDescription.problem}" -o table
```
### 2. Findings register
```text
| ID | Pillar      | Finding                                                         | Evidence                         | Risk | Recommendation                                        | Effort | Owner       |
|----|-------------|-----------------------------------------------------------------|----------------------------------|------|-------------------------------------------------------|--------|-------------|
| R1 | Reliability | Azure SQL database not zone redundant; RTO target 1 h           | Resource Graph: zoneRedundant=false | High | Enable zone redundancy; add failover group to paired region | M | team-claims |
| S1 | Security    | Storage account allows public network access                    | publicNetworkAccess=Enabled      | High | Private endpoint + disable public access; Policy deny   | S      | team-claims |
| O1 | OpEx        | No alerts on failed requests; only CPU alerts                   | Azure Monitor alert rules        | Med  | Availability and latency alerts from App Insights SLIs | S      | team-claims |
| C1 | Cost        | App Service Plan P3v3 at 12% average CPU                        | Advisor + metrics (30 days)      | Low  | Scale down to P1v3 with autoscale rules                 | S      | team-claims |
| T1 | Trade-off   | Single-region deployment accepted; RTO 8 h for regional outage  | Business decision                | Accepted by product owner, review 2027-03 | - | - | product    |
```
**Why it's right:**
- Findings are backed by queries and platform recommendations against the workload's actual resources.
- Each finding has a pillar, risk, recommendation, effort, and owner, and trade-offs are accepted explicitly with a review date.
