---
name: aws-well-architected-review
description: "Running AWS Well-Architected Framework reviews across the six pillars (operational excellence, security, reliability, performance efficiency, cost optimization, sustainability) with the Well-Architected Tool, lenses, milestones, and evidence from Security Hub, Trusted Advisor, Compute Optimizer, and Resilience Hub, producing prioritized, owned findings. Use it when assessing or improving an AWS workload architecture."
---

# Skill: AWS Well-Architected Review

## Implementation Rules:
- **[MANDATORY]** Scope every review to one workload with a named owner, business criticality, RTO/RPO, compliance scope, accounts, and Regions, and cover all six pillars; a review that skips a pillar states why.
- **[MANDATORY]** Base answers on evidence, not interviews alone: IaC and pipeline definitions, architecture diagrams, CloudWatch dashboards and alarms, runbooks, AWS Config and Security Hub CSPM findings, Trusted Advisor checks, Compute Optimizer and Resilience Hub reports, and backup restore records.
- **[PATTERN]** Record the review in the AWS Well-Architected Tool (`aws wellarchitected create-workload`) with the relevant lenses (Serverless Applications Lens, SaaS Lens, or a custom lens for internal standards) and save a milestone per review so risk trends are measurable.
- **[PATTERN]** Every finding states the pillar and best practice ID (for example `REL09-BP04`, `SEC01-BP01`), risk level (high or medium), evidence, business impact, a concrete recommendation, effort, owner, and target date; findings go into the team backlog, not only into a slide deck.
- **[ARCHITECTURE]** Prioritize by risk first, then effort: high-risk issues that threaten data loss, security breach, or extended outage come before optimizations; group quick wins separately and never let cost or performance items outrank open high-risk security or reliability issues.
- **[SECURITY]** Security pillar checks include no root user usage, human access through IAM Identity Center, no long-lived access keys, organization CloudTrail, GuardDuty and Security Hub enabled in every account and Region in use, KMS encryption at rest, TLS in transit, IMDSv2, and public access blocked by default.
- **[ARCHITECTURE]** Reliability checks cover multi-AZ deployment, a DR strategy matched to RTO/RPO (backup and restore, pilot light, warm standby, multi-site active/active), quotas with headroom, timeouts, retries with backoff, idempotency, and AWS Backup plans with tested restores.
- **[PATTERN]** Operational excellence and performance checks cover IaC for all resources, automated deployments with rollback, SLO-based alarms, runbooks for every alarm, load tests at expected peak, and caching or Graviton adoption where evidence supports it.
- **[FORBIDDEN]** Checkbox reviews with every question marked as addressed, generic findings without evidence ("improve security"), recommending multi-Region active/active without a business requirement, and closing a finding before the remediation is verified.
- **[TESTING]** Verify remediations objectively: AWS FIS experiments for AZ or dependency failure, restore tests for backups, Config rules or Security Hub controls turning compliant, and load tests; then update the workload answers and save a new milestone.
- **[PATTERN]** Re-review on a fixed cadence (at least yearly) and after major architecture changes; automate continuous checks (Config conformance packs, Security Hub standards) so the next review starts from current data.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
