# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One account for everything and a region SCP that breaks global services
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": { "StringNotEquals": { "aws:RequestedRegion": "eu-west-1" } }
  }]
}
```
**Why it's wrong:**
- IAM, Organizations, STS, CloudFront, Route 53, and Support are served from us-east-1 endpoints, so this policy breaks global services for every principal.
- Attached to the single account that also runs dev, test, and production, it offers no blast-radius isolation and cannot be staged safely.

## Best Practice (How to do it right)

### 1. Baseline guardrail SCP with global-service exemptions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyLeaveOrganization",
      "Effect": "Deny",
      "Action": "organizations:LeaveOrganization",
      "Resource": "*"
    },
    {
      "Sid": "ProtectSecurityServices",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "cloudtrail:UpdateTrail",
        "config:StopConfigurationRecorder", "config:DeleteConfigurationRecorder",
        "guardduty:DeleteDetector", "securityhub:DisableSecurityHub"
      ],
      "Resource": "*",
      "Condition": { "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/org-security-admin" } }
    },
    {
      "Sid": "DenyUnapprovedRegions",
      "Effect": "Deny",
      "NotAction": [
        "iam:*", "organizations:*", "sts:*", "support:*", "cloudfront:*", "route53:*",
        "budgets:*", "ce:*", "health:*", "globalaccelerator:*", "wafv2:*", "kms:*"
      ],
      "Resource": "*",
      "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] } }
    }
  ]
}
```
`organization.tf`:
```hcl
resource "aws_organizations_organizational_unit" "workloads_prod" {
  name      = "Prod"
  parent_id = aws_organizations_organizational_unit.workloads.id
}

resource "aws_organizations_policy" "baseline_guardrails" {
  name        = "baseline-guardrails"
  description = "Protect security services, restrict Regions"
  type        = "SERVICE_CONTROL_POLICY"
  content     = file("${path.module}/policies/baseline-guardrails.json")
}

resource "aws_organizations_policy_attachment" "baseline_workloads" {
  policy_id = aws_organizations_policy.baseline_guardrails.id
  target_id = aws_organizations_organizational_unit.workloads.id
}
```
**Why it's right:**
- Guardrails are code, attached at OU level, and inherited by every vended account.
- Security services cannot be disabled except by the dedicated security role, and global services keep working under the Region restriction (extend the `NotAction` list from the AWS reference example for the services you use).
- The policy is validated with `aws accessanalyzer validate-policy --policy-type SERVICE_CONTROL_POLICY` and tested in the Policy Staging OU first.
