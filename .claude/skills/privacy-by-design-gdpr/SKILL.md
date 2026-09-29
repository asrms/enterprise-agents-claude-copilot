---
name: privacy-by-design-gdpr
description: "Privacy by design and by default for software systems under GDPR and similar laws: data mapping and records of processing, lawful basis and purpose limitation, data minimization, consent management, data protection impact assessments, pseudonymization, retention, data subject rights automation, international transfers, processors and sub-processors, and privacy in logs and analytics. Use it when designing features or systems that process personal data."
---

# Skill: Privacy by Design (GDPR)

## Implementation Rules:
- **[MANDATORY]** Map personal data for every system and feature: categories of data and data subjects, purposes, lawful basis, sources, recipients, storage locations, retention, and transfers; keep it in the records of processing and update it with every change.
- **[MANDATORY]** Minimize by design: collect only the data needed for the stated purpose, prefer derived or aggregated data, make optional fields truly optional, and default to the most privacy-protective settings (privacy by default).
- **[PATTERN]** Assess high-risk processing with a Data Protection Impact Assessment before building (large-scale sensitive data, systematic monitoring, profiling with significant effects, new technologies such as AI on personal data), involving the Data Protection Officer.
- **[MANDATORY]** When consent is the lawful basis, collect it granularly and freely (no pre-ticked boxes), record who consented to what, when, and to which text version, make withdrawal as easy as giving consent, and enforce it technically in data flows (for example, analytics and marketing tags respect consent state).
- **[PATTERN]** Pseudonymize identifiers early in pipelines (keyed hashing or tokenization with keys held separately), and anonymize data for analytics where identification is not needed, validating that re-identification risk is low.
- **[MANDATORY]** Implement data subject rights as product features: access/export in a machine-readable format, rectification, erasure (including derived data, caches, search indexes, and downstream processors), restriction, and objection, with identity verification and statutory response times tracked.
- **[PATTERN]** Enforce retention automatically with deletion or anonymization jobs per data category, and ensure backups follow the retention design or erasure is re-applied after restores.
- **[SECURITY]** Protect personal data with access controls based on need-to-know, encryption, audit logging of access to sensitive records, and breach detection; prepare a breach response process that supports notification to the authority within 72 hours where required.
- **[FORBIDDEN]** Personal data in logs, URLs, analytics events, error trackers, or test environments without necessity and safeguards; repurposing data for incompatible purposes; and dark patterns in consent interfaces.
- **[PATTERN]** Govern processors and transfers: data processing agreements with vendors, a register of sub-processors, data residency choices, and transfer mechanisms (adequacy decisions, standard contractual clauses with transfer impact assessments) for data leaving the EEA.
- **[TESTING]** Test privacy controls: automated checks that new fields are classified, scanners for personal data in logs and non-production environments, end-to-end tests for export and erasure across all stores, and consent-state tests for tracking.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
