# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Local state and one giant stack
```text
infra/
  main.tf                  # VPC, databases, clusters, DNS for dev, staging, and prod
  terraform.tfstate        # committed to Git, contains database passwords
```
```bash
terraform state rm aws_db_instance.main     # ad hoc, from a laptop, no backup
terraform apply -auto-approve               # production credentials on the laptop
```
**Why it's wrong:**
- Secrets in state are committed to Git, and two people applying concurrently corrupt the state.
- One state for all environments means every change risks production and locks everyone.
- Manual state commands are unreviewed and irreversible.

## Best Practice (How to do it right)

### 1. Isolated stacks with an encrypted, locked backend
```text
live/
  prod/
    network/backend.tf
    data/backend.tf
    app/backend.tf
  staging/
    network/backend.tf
    ...
modules/
```
`live/prod/data/backend.tf`:
```hcl
terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    key          = "prod/data/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    kms_key_id   = "alias/tfstate-prod"
    use_lockfile = true
  }
}
```
### 2. Reviewed state changes as code
```hcl
# adopt a database created manually during an incident
import {
  to = aws_db_instance.orders
  id = "orders-prod"
}

# stop managing a resource handed over to another team, without destroying it
removed {
  from = aws_route53_record.legacy
  lifecycle {
    destroy = false
  }
}
```
```bash
# CI: plan with a read-only role, apply the exact saved plan after approval
terraform plan -input=false -lock-timeout=5m -out=tfplan
terraform show -no-color tfplan > plan.txt
terraform apply -input=false tfplan
```
**Why it's right:**
- State is remote, encrypted with KMS, versioned, and locked; each environment and component has its own small state.
- Imports and removals are reviewed in pull requests and visible in the plan.
- The applied plan is exactly the one that was reviewed, executed by the pipeline rather than a laptop.
