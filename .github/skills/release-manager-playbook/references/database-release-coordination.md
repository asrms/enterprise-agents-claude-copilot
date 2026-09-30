# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Coupled rename in a single release
```text
Release 5.2 (Friday 17:00)
  - migration: ALTER TABLE invoice RENAME COLUMN amount TO total_amount;
  - code: reads and writes total_amount
Rollout: pods restart one by one; old pods fail with "column amount does not exist"
Rollback: code reverted, but the column is already renamed -> outage continues until manual DDL
```
**Why it's wrong:**
- Old and new application versions cannot run against the same schema, so every rolling deployment causes errors.
- Rolling back the code does not roll back the schema; recovery requires emergency manual changes.

## Best Practice (How to do it right)

### 1. Multi-release plan with compatibility at every step
```text
Change: invoice.amount -> invoice.total_amount (owner: team-billing, ticket BIL-88)

Release 5.2  expand     add nullable total_amount; code writes both, reads amount
             verify     SELECT count(*) FROM invoice WHERE total_amount IS NULL AND created_at > <release time>  -> 0
Job          backfill   batched copy amount -> total_amount (10k rows/batch, pause if replica lag > 5s)
Release 5.3  switch     code reads total_amount, still writes both
             verify     no reads of amount in query logs for 7 days; reporting team confirmed migration
Release 5.4  tighten    total_amount NOT NULL (NOT VALID + VALIDATE)
Release 5.5  contract   stop writing amount; drop column after snapshot verified

Rollback per step: 5.2-5.4 -> redeploy previous version (schema compatible); 5.5 -> restore column from snapshot if needed
```
### 2. Pipeline with a separate migration stage
```yaml
stages: [build, migrate, deploy, verify]

migrate:
  stage: migrate
  image: registry.example.com/billing-migrations:${CI_COMMIT_TAG}
  script:
    - flyway -configFiles=conf/production.conf info
    - flyway -configFiles=conf/production.conf migrate
  environment: production
  timeout: 20m
  resource_group: billing-db-production       # one migration at a time

deploy:
  stage: deploy
  needs: [migrate]
  script: ./scripts/deploy.sh "$CI_COMMIT_TAG"
  environment: production
```
**Why it's right:**
- Every release runs correctly with both the previous and the next application version, so rollbacks are always a redeploy.
- Each step has a verification condition, and the destructive step comes last, after a verified snapshot.
- Migrations run once, serialized, and visible as their own stage before the rollout.
