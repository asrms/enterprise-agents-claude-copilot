# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Environment branching inside one stack
```hcl
resource "aws_db_instance" "main" {
  instance_class      = terraform.workspace == "prod" ? "db.r7g.2xlarge" : "db.t4g.small"
  multi_az            = terraform.workspace == "prod"
  deletion_protection = terraform.workspace == "prod" ? true : false
}

resource "aws_cloudwatch_metric_alarm" "cpu" {
  count = terraform.workspace == "prod" ? 1 : 0   # staging never tests alarms
}
```
**Why it's wrong:**
- Production-only behavior is never exercised in staging; conditionals spread through every module.
- Workspaces share the backend and credentials, so a mistake in the workspace name affects production.

## Best Practice (How to do it right)

### 1. Live stacks per environment, pinned modules, explicit differences
```text
modules/                      # separate repository, tagged releases
  postgres/  network/  service/
live/
  globals.hcl                 # account ids, regions, CIDR plan
  staging/
    account.hcl
    eu-west-1/
      network/terragrunt.hcl
      data/terragrunt.hcl
  prod/
    account.hcl
    eu-west-1/
      network/terragrunt.hcl
      data/terragrunt.hcl
```
`live/prod/eu-west-1/data/terragrunt.hcl`:
```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "git::https://github.com/acme/terraform-modules.git//postgres?ref=v3.2.0"
}

dependency "network" {
  config_path = "../network"
}

inputs = {
  name                = "orders"
  instance_class      = "db.r7g.2xlarge"
  multi_az            = true
  deletion_protection = true
  subnet_ids          = dependency.network.outputs.private_subnet_ids
}
```
`live/staging/eu-west-1/data/terragrunt.hcl` differs only in `ref`, `instance_class`, and sizing inputs.
```bash
# CI for a pull request touching live/prod/eu-west-1/data
terragrunt run --working-dir live/prod/eu-west-1/data -- plan -out tfplan
```
**Why it's right:**
- Each environment has its own account, backend, and stack; differences are a few explicit inputs.
- Module versions are pinned per environment and promoted from staging to production.
- Dependencies between components are declared and orchestrated by the tool.
