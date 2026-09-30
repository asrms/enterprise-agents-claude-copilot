---
name: azure-well-architected-review
description: "Reviewing Azure workloads against the Azure Well-Architected Framework: the five pillars (reliability, security, cost optimization, operational excellence, performance efficiency), service guides, Azure Advisor and Microsoft Defender for Cloud recommendations, Azure Resource Graph queries for evidence, failure mode analysis, and producing prioritized, owned remediation plans. Use it when assessing or reviewing an Azure architecture."
---

# Skill: Azure Well-Architected Review

## Implementation Rules:
- **[MANDATORY]** Scope each review to a workload (its subscriptions, resource groups, dependencies, and critical user flows) with its business requirements: availability and recovery targets (SLO, RTO, RPO), data classification, compliance obligations, and budget.
- **[MANDATORY]** Assess all five pillars of the Azure Well-Architected Framework (reliability, security, cost optimization, operational excellence, performance efficiency) using the Well-Architected Review assessment and the service guides for each service in use.
- **[PATTERN]** Gather evidence from the environment rather than opinions: Azure Advisor recommendations, Microsoft Defender for Cloud secure score and regulatory compliance, Azure Policy compliance state, and Azure Resource Graph queries for configuration facts (zones, SKUs, public endpoints, diagnostic settings).
- **[PATTERN]** Perform a failure mode analysis for critical flows: identify each component and dependency, how it can fail (zone outage, throttling, expired certificate, bad deployment), detection, and mitigation; verify that availability zones, redundancy, and backups match the stated targets.
- **[PATTERN]** Evaluate security with the Microsoft cloud security benchmark in mind: identity (Entra ID, managed identities, PIM), network exposure (public endpoints, private endpoints, WAF), data protection (encryption, Key Vault), logging, and threat protection coverage.
- **[PATTERN]** Evaluate operations: infrastructure as code coverage (Bicep or Terraform), deployment practices (safe deployment with slots or progressive rollout), monitoring with Azure Monitor and Application Insights, alerting on SLO-relevant signals, and runbooks.
- **[MANDATORY]** Produce findings with pillar, description, evidence, risk (impact and likelihood), recommendation, effort, and owner; prioritize by risk to business objectives, and track them in the team backlog with review dates.
- **[FORBIDDEN]** Generic recommendations not tied to the workload's requirements, reviews based only on diagrams without inspecting deployed configuration, and accepting high risks without a named approver and review date.
- **[PATTERN]** Record trade-offs explicitly (for example single-region deployment to save cost with a documented RTO), because pillars can conflict and the business must choose knowingly.
- **[PATTERN]** Re-run the review after significant architectural changes and at least annually, comparing with previous findings to show progress.
- **[TESTING]** Validate key claims: test backup restores and failover, run load tests against performance targets, and verify alerts fire, rather than trusting configuration alone.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
