# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Silencing drift instead of resolving it
```hcl
resource "aws_security_group" "app" {
  name   = "app"
  vpc_id = var.vpc_id

  lifecycle {
    ignore_changes = all          # someone added 0.0.0.0/0 in the console; now invisible forever
  }
}
```
```bash
terraform apply -refresh-only -auto-approve     # "fix" drift by accepting whatever is in the cloud
```
**Why it's wrong:**
- Any manual change, including dangerous ones, is permanently hidden from review.
- Accepting the live state blindly turns click-ops into the new source of truth.

## Best Practice (How to do it right)

### 1. Scheduled drift detection with alerting (GitHub Actions)
```yaml
name: drift-detection
on:
  schedule:
    - cron: '17 5 * * *'
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
  issues: write
jobs:
  plan:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        stack: [prod/eu-west-1/network, prod/eu-west-1/data, prod/eu-west-1/app]
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: aws-actions/configure-aws-credentials@b47578312673ae6fa5b5096b330d9fbac3d116df # v4.2.1
        with:
          role-to-assume: ${{ vars.DRIFT_READONLY_ROLE_ARN }}
          aws-region: eu-west-1
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd # v3.1.2
        with:
          terraform_wrapper: false
      - id: plan
        working-directory: live/${{ matrix.stack }}
        run: |
          terraform init -input=false
          set +e
          terraform plan -input=false -lock=false -detailed-exitcode -no-color > plan.txt
          echo "exitcode=$?" >> "$GITHUB_OUTPUT"
      - if: steps.plan.outputs.exitcode == '2'
        env:
          GH_TOKEN: ${{ github.token }}
          STACK: ${{ matrix.stack }}
        run: |
          gh issue create --title "Drift detected in $STACK" --label drift \
            --body-file "live/$STACK/plan.txt"
      - if: steps.plan.outputs.exitcode == '1'
        run: exit 1
```
### 2. Narrow, documented ignore_changes
```hcl
resource "aws_ecs_service" "api" {
  name          = "api"
  desired_count = 3

  lifecycle {
    # desired_count is managed by Application Auto Scaling; task_definition by the deploy pipeline
    ignore_changes = [desired_count, task_definition]
  }
}
```
**Why it's right:**
- Drift is detected daily with read-only credentials and turned into a tracked issue for the owning team.
- Only attributes owned by other systems are ignored, with the owner documented.
