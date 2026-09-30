# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Untyped, hard-coded, count-indexed module
```hcl
provider "aws" {
  region     = "eu-west-1"
  access_key = "AKIA..."                     # credentials in code
  secret_key = "..."
}

variable "buckets" {}                         # no type, no description

resource "aws_s3_bucket" "this" {
  count  = length(var.buckets)                # removing the first item recreates all others
  bucket = var.buckets[count.index]
}
```
**Why it's wrong:**
- Credentials and a provider configuration inside a child module make it unusable and unsafe.
- An untyped variable accepts anything; `count` indexing causes destructive changes when the list changes.
- No encryption, public access block, tags, or outputs.

## Best Practice (How to do it right)

### 1. Typed, validated, secure-by-default module
`versions.tf`:
```hcl
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.60, < 7.0" }
  }
}
```
`variables.tf`:
```hcl
variable "name_prefix" {
  type        = string
  description = "Prefix for bucket names, for example acme-prod-orders."
  validation {
    condition     = can(regex("^[a-z0-9-]{3,40}$", var.name_prefix))
    error_message = "name_prefix must be 3-40 lowercase letters, digits, or hyphens."
  }
}

variable "buckets" {
  type = map(object({
    versioning     = optional(bool, true)
    retention_days = optional(number)
  }))
  description = "Buckets to create, keyed by a stable logical name."
}
```
`main.tf`:
```hcl
resource "aws_s3_bucket" "this" {
  for_each = var.buckets
  bucket   = "${var.name_prefix}-${each.key}"
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
  }
}

moved {
  from = aws_s3_bucket.bucket
  to   = aws_s3_bucket.this["main"]
}
```
`outputs.tf`:
```hcl
output "bucket_arns" {
  description = "ARNs of the created buckets, keyed by logical name."
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
}
```
**Why it's right:**
- The module has no provider credentials, declares version constraints, and validates typed inputs.
- `for_each` with stable keys makes changes additive; security settings are on by default.
- A `moved` block migrates existing state without recreating the bucket.
