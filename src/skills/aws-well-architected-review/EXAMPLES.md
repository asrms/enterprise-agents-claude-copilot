# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Findings without evidence, owner, or priority
```text
Well-Architected Review - Orders platform
- Security: looks fine overall
- Reliability: consider multi-region active/active
- Cost: use Savings Plans
- Performance: add caching somewhere
Status: all questions answered (no high risks)
```
**Why it's wrong:**
- No evidence, best practice IDs, impact, owners, or dates, so nothing is actionable or verifiable.
- Multi-Region active/active is proposed without an RTO/RPO requirement, while real risks (untested restores, single-AZ database) stay invisible.

## Best Practice (How to do it right)

### 1. Record the workload, gather evidence, and save a milestone
```bash
aws wellarchitected create-workload \
  --workload-name orders-prod --environment PRODUCTION \
  --description "Order capture and fulfilment APIs" \
  --review-owner platform-architecture@example.com \
  --aws-regions eu-west-1 --lenses wellarchitected serverless

# Evidence: active critical and high Security Hub findings for the workload account
aws securityhub get-findings --filters '{
  "AwsAccountId":[{"Value":"111122223333","Comparison":"EQUALS"}],
  "SeverityLabel":[{"Value":"CRITICAL","Comparison":"EQUALS"},{"Value":"HIGH","Comparison":"EQUALS"}],
  "RecordState":[{"Value":"ACTIVE","Comparison":"EQUALS"}]}' \
  --query 'Findings[].{Control:Compliance.SecurityControlId,Resource:Resources[0].Id}'

aws wellarchitected create-milestone --workload-id "$WORKLOAD_ID" --milestone-name 2026-Q3-baseline
```
**Why it's right:**
- The workload, lenses, and milestone make the review repeatable and risk trends measurable.
- Findings are backed by account-scoped data instead of opinions.

### 2. Prioritized findings register
```markdown
| # | Pillar      | Best practice | Risk | Evidence                                       | Recommendation                                      | Effort | Owner    | Due        |
|---|-------------|---------------|------|------------------------------------------------|-----------------------------------------------------|--------|----------|------------|
| 1 | Reliability | REL09-BP04    | High | No restore of orders-db in the last 12 months  | Enable AWS Backup restore testing, run a quarterly drill | S | db-team  | 2026-10-31 |
| 2 | Security    | SEC02-BP02    | High | 3 IAM users with access keys older than 90 days | Move CI to OIDC roles, delete keys                  | S      | platform | 2026-10-15 |
| 3 | Reliability | REL10-BP01    | High | RDS instance is Single-AZ                      | Enable Multi-AZ, run an AWS FIS AZ failure experiment | M    | db-team  | 2026-11-15 |
| 4 | Cost        | COST06-BP03   | Med  | Compute Optimizer: 7 over-provisioned instances | Rightsize after two weeks of metrics               | S      | orders   | 2026-12-01 |
```
**Why it's right:**
- High-risk reliability and security issues come first; each has evidence, an owner, and a date.
- Each remediation has an objective verification (restore drill, FIS experiment, control status) before closure.
