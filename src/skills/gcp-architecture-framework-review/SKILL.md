---
name: gcp-architecture-framework-review
description: "Reviewing Google Cloud workloads against the Google Cloud Well-Architected Framework: operational excellence, security, reliability, cost optimization, and performance pillars, evidence from Security Command Center, Active Assist recommendations, Cloud Asset Inventory queries, failure mode analysis, and prioritized, owned remediation plans. Use it when assessing or reviewing an architecture on Google Cloud."
---

# Skill: Google Cloud Architecture Framework Review

## Implementation Rules:
- **[MANDATORY]** Scope each review to a workload (its folders and projects, dependencies, and critical user journeys) and capture its requirements: SLOs, RTO and RPO, data classification and residency, compliance obligations, and budget.
- **[MANDATORY]** Assess every pillar of the Google Cloud Well-Architected Framework (operational excellence; security, privacy, and compliance; reliability; cost optimization; performance optimization), including cross-cutting AI and ML guidance when the workload uses it.
- **[PATTERN]** Collect evidence from the platform: Security Command Center findings and posture, Active Assist recommenders (IAM, idle resources, rightsizing, commitments), Cloud Asset Inventory searches for configuration facts, organization policy constraints in effect, and Cloud Monitoring SLOs and alerting policies.
- **[PATTERN]** Run a failure mode analysis per critical journey: zonal and regional failures, quota exhaustion, dependency outages, bad deployments, and expired credentials; check that regional resources, multi-zone instance groups, backups, and failover match the targets.
- **[PATTERN]** Evaluate security with the resource hierarchy, IAM (no basic roles, workload identity, no service account keys), VPC Service Controls for sensitive data perimeters, encryption (CMEK where required), and logging (Data Access audit logs for sensitive services).
- **[PATTERN]** Evaluate operations: infrastructure as code coverage, CI/CD with Cloud Build or other pipelines using workload identity federation, progressive delivery (Cloud Run traffic splitting, Cloud Deploy canaries), observability with Cloud Monitoring and Cloud Trace, and runbooks.
- **[MANDATORY]** Produce findings with pillar, evidence, risk, recommendation, effort, and owner, prioritized by business risk and tracked in the backlog with review dates; trade-offs accepted by the business are recorded explicitly.
- **[FORBIDDEN]** Reviews based only on diagrams without inspecting deployed resources, generic best practices not linked to requirements, and high-risk findings left without owner or decision.
- **[PATTERN]** Quantify where possible (cost of idle resources from recommenders, availability from SLO reports, percentage of projects compliant with key constraints) to make priorities defensible.
- **[PATTERN]** Repeat reviews after major changes and at least annually, comparing progress against previous findings.
- **[TESTING]** Verify critical claims with tests: restore backups, fail over regional databases in non-production, run load tests against performance targets, and confirm alerts reach on-call.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
