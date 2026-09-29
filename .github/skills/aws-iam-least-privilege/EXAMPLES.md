# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Wildcard application policy and an open PassRole
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:*", "dynamodb:*", "sqs:*"], "Resource": "*" },
    { "Effect": "Allow", "Action": "iam:PassRole", "Resource": "*" }
  ]
}
```
**Why it's wrong:**
- The orders service can delete any bucket, table, or queue in the account, including other teams' data.
- `iam:PassRole` on `*` lets it hand an administrator role to a new Lambda function or EC2 instance and escalate privileges.

## Best Practice (How to do it right)

### 1. Scoped policy document in Terraform
```hcl
data "aws_iam_policy_document" "orders_api" {
  statement {
    sid       = "ReadWriteOrdersTable"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
    resources = [aws_dynamodb_table.orders.arn, "${aws_dynamodb_table.orders.arn}/index/*"]
  }

  statement {
    sid       = "ReadInvoiceObjects"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.invoices.arn}/invoices/*"]
  }

  statement {
    sid       = "PublishOrderEvents"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.order_events.arn]
  }

  statement {
    sid       = "UseDataKey"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.orders.arn]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["dynamodb.${data.aws_region.current.region}.amazonaws.com", "sqs.${data.aws_region.current.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "orders_api" {
  name   = "orders-api"
  role   = aws_iam_role.orders_api.id
  policy = data.aws_iam_policy_document.orders_api.json
}
```
**Why it's right:**
- Every statement names specific actions and resources; the KMS key is usable only through DynamoDB and SQS.
- The policy is generated from typed HCL, so references stay correct when resources are renamed.

### 2. Policy checks in CI
```bash
terraform show -json tfplan > plan.json   # extract the policy JSON from the plan
aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY \
  --policy-document file://orders-api.json \
  --query 'findings[?findingType==`ERROR` || findingType==`SECURITY_WARNING`]'

aws accessanalyzer check-access-not-granted --policy-type IDENTITY_POLICY \
  --policy-document file://orders-api.json \
  --access '[{"actions":["iam:PassRole","s3:DeleteBucket","dynamodb:DeleteTable"]}]'

aws accessanalyzer check-no-new-access --policy-type IDENTITY_POLICY \
  --existing-policy-document file://orders-api.main.json \
  --new-policy-document file://orders-api.json
```
**Why it's right:**
- Syntax errors and security warnings fail the build before review.
- Sensitive actions are proven absent, and any widening of access versus `main` is flagged for explicit approval.
