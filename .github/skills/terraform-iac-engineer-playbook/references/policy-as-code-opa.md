# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Untested policy on raw HCL with a vague message
```rego
package main

deny[msg] {
  input.resource.aws_s3_bucket[_].acl == "public-read"
  msg = "bad bucket"
}
```
**Why it's wrong:**
- It inspects HCL, so ACLs set through variables, modules, or separate `aws_s3_bucket_acl` resources are missed.
- Deprecated syntax, no resource address or remediation in the message, and no tests.

## Best Practice (How to do it right)

### 1. Plan-based Rego with helpers, severities, exceptions, and tests
`policy/terraform/storage.rego`:
```rego
package terraform.storage

import rego.v1

changed_resources contains rc if {
  some rc in input.resource_changes
  some action in rc.change.actions
  action in {"create", "update"}
}

exempt(address) if {
  some e in data.exceptions
  e.address == address
  time.parse_rfc3339_ns(e.expires) > time.now_ns()
}

deny contains msg if {
  some rc in changed_resources
  rc.type == "aws_s3_bucket_public_access_block"
  not rc.change.after.block_public_policy
  not exempt(rc.address)
  msg := sprintf("%s: block_public_policy must be true (set it in the module input or request an exception)", [rc.address])
}

warn contains msg if {
  some rc in changed_resources
  startswith(rc.type, "aws_")
  not rc.change.after.tags_all.cost_center
  msg := sprintf("%s: missing cost_center tag (will be denied from 2026-12-01)", [rc.address])
}
```
`policy/terraform/storage_test.rego`:
```rego
package terraform.storage_test

import rego.v1
import data.terraform.storage

test_denies_unblocked_public_policy if {
  plan := {"resource_changes": [{
    "address": "module.data.aws_s3_bucket_public_access_block.this[\"main\"]",
    "type": "aws_s3_bucket_public_access_block",
    "change": {"actions": ["create"], "after": {"block_public_policy": false}},
  }]}
  count(storage.deny) == 1 with input as plan with data.exceptions as []
}

test_allows_blocked_public_policy if {
  plan := {"resource_changes": [{
    "address": "aws_s3_bucket_public_access_block.ok",
    "type": "aws_s3_bucket_public_access_block",
    "change": {"actions": ["create"], "after": {"block_public_policy": true}},
  }]}
  count(storage.deny) == 0 with input as plan with data.exceptions as []
}
```
```bash
opa test policy/ --coverage --format=json | jq '.coverage'
terraform show -json tfplan > tfplan.json
conftest test tfplan.json --policy policy/terraform --namespace terraform.storage --data exceptions.json
```
**Why it's right:**
- Policies evaluate resolved planned values and actions, name the offending resource, and explain the fix.
- Warnings allow gradual rollout; exceptions are data with expiry dates.
- Unit tests cover both outcomes, and coverage is measured in CI.
