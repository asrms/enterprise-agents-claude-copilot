# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unowned spend and surprise bills
```text
Single shared account for all teams, 40% of resources untagged
Monthly bill reviewed by finance only, 3 weeks after month end
Dev environments (m6i.4xlarge, gp2 volumes) run 24/7; 1.2 TB of snapshots from 2023
NAT gateway data processing is the 3rd largest line item (S3 traffic through NAT)
A 3-year Reserved Instance bought for a service decommissioned 4 months later
```
**Why it's wrong:**
- Nobody can attribute or act on costs, anomalies are discovered weeks late, and idle resources run continuously.
- Commitments were purchased without a stable baseline, and avoidable data transfer charges go unnoticed.

## Best Practice (How to do it right)

### 1. Tag policy, budget, and anomaly detection as code (Terraform)
```hcl
resource "aws_organizations_policy" "required_tags" {
  name = "required-cost-tags"
  type = "TAG_POLICY"
  content = jsonencode({
    tags = {
      "cost-center" = { tag_key = { "@@assign" = "cost-center" }, enforced_for = { "@@assign" = ["ec2:instance", "rds:db", "s3:bucket"] } }
      "owner"       = { tag_key = { "@@assign" = "owner" } }
    }
  })
}

resource "aws_budgets_budget" "payments_prod" {
  name         = "payments-prod-monthly"
  budget_type  = "COST"
  limit_amount = "12000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:cost-center$payments"]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 90
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["payments-owners@example.com"]
  }
}

resource "aws_ce_anomaly_monitor" "services" {
  name              = "service-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}
```
### 2. Gateway endpoint to avoid NAT processing charges for S3
```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.eu-west-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}
```
**Why it's right:**
- Tags are enforced by policy, budgets alert owners on forecasts, and anomaly detection flags unexpected service spend quickly.
- S3 traffic from private subnets bypasses the NAT gateway, removing a large and avoidable cost; changes are reviewed as code.
