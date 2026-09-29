---
name: nonfunctional-requirements
description: "Eliciting and specifying non-functional requirements (quality attributes): performance, scalability, availability, recoverability, security, privacy, accessibility, usability, maintainability, compliance, and cost, written as measurable scenarios with ISO/IEC 25010 as a checklist, prioritized with stakeholders, and turned into testable acceptance criteria and fitness functions. Use it when gathering requirements for a system or feature, or reviewing whether quality expectations are specified."
---

# Skill: Non-Functional Requirements

## Implementation Rules:
- **[MANDATORY]** Elicit quality requirements explicitly for every new system and significant feature, using a checklist (ISO/IEC 25010 characteristics: performance efficiency, reliability, security, usability, maintainability, compatibility, portability, plus privacy, compliance, and cost).
- **[MANDATORY]** Make each requirement measurable and testable, stating the metric, target, and conditions: "95% of search requests return in under 500 ms at 200 requests per second", not "search must be fast".
- **[PATTERN]** Express important requirements as quality attribute scenarios: source, stimulus, environment, artifact, response, and response measure (for example, "when a zone fails during peak load, checkout continues with less than 1% errors within 2 minutes").
- **[PATTERN]** Derive targets from business context: user expectations, contractual SLAs, regulatory obligations, peak events, growth forecasts, and the cost of downtime or data loss (RTO and RPO); record the source of each number.
- **[PATTERN]** Prioritize with stakeholders using utility trees or a ranked list, because quality attributes conflict (consistency vs availability, security vs usability, performance vs cost), and document the accepted trade-offs.
- **[MANDATORY]** Cover security and privacy requirements explicitly: authentication and authorization levels, data classification, retention, audit, encryption, and applicable standards (for example OWASP ASVS level, GDPR obligations).
- **[MANDATORY]** Include accessibility (WCAG 2.2 AA as the default for user interfaces), supported platforms and browsers, localization, and operational requirements (monitoring, alerting, backup, supportability).
- **[FORBIDDEN]** Adjectives without numbers ("scalable", "secure", "highly available"), copying targets from other systems without justification, 100% availability or zero-latency goals, and leaving quality requirements implicit until performance or security testing at the end.
- **[PATTERN]** Record requirements in a shared, versioned place (requirements document, architecture documentation, or a quality attributes section of the ADRs) with owners, and link them to the stories, tests, and SLOs that implement them.
- **[PATTERN]** Turn requirements into verification: acceptance criteria, load tests, security tests, accessibility audits, SLOs and alerts, and architecture fitness functions that run continuously.
- **[TESTING]** Review requirements with architects, operations, and security before design is finalized, and revisit them when business context changes (new markets, growth, regulations).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
