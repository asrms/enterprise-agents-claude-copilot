# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. "Testing" by applying to a shared account
```bash
cd modules/bucket
terraform apply -auto-approve -var name=test-bucket    # shared dev account, fixed name
# look at the console, seems fine
# forget to destroy
```
**Why it's wrong:**
- Manual, unrepeatable verification in a shared account; fixed names collide with other runs.
- Leaked resources cost money, and nothing prevents regressions in the next change.

## Best Practice (How to do it right)

### 1. Plan-only tests with a mock provider
`modules/bucket/tests/defaults.tftest.hcl`:
```hcl
mock_provider "aws" {}

variables {
  name_prefix = "acme-test"
  buckets     = { main = {} }
}

run "secure_defaults" {
  command = plan

  assert {
    condition     = aws_s3_bucket_public_access_block.this["main"].block_public_policy == true
    error_message = "Public access must be blocked by default."
  }

  assert {
    condition     = length(aws_s3_bucket.this) == 1
    error_message = "Exactly one bucket should be planned."
  }
}

run "rejects_invalid_prefix" {
  command = plan

  variables {
    name_prefix = "Invalid_Prefix"
  }

  expect_failures = [var.name_prefix]
}
```
### 2. Guarantees encoded in configuration
```hcl
data "aws_vpc" "selected" {
  id = var.vpc_id

  lifecycle {
    postcondition {
      condition     = self.enable_dns_support
      error_message = "The VPC must have DNS support enabled."
    }
  }
}

check "health" {
  data "http" "api" {
    url = "https://${aws_lb.api.dns_name}/health"
  }
  assert {
    condition     = data.http.api.status_code == 200
    error_message = "API health endpoint is not returning 200."
  }
}
```
```bash
terraform init -backend=false
terraform test                       # runs every tests/*.tftest.hcl
```
**Why it's right:**
- Fast, credential-free tests verify secure defaults and input validation on every pull request.
- Preconditions, postconditions, and check blocks document and enforce assumptions at plan and apply time.
