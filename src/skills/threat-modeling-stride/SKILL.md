---
name: threat-modeling-stride
description: "Threat modeling for systems and features: scoping with data flow diagrams and trust boundaries, STRIDE per element, attack trees, abuse cases, rating with likelihood and impact, mitigations mapped to controls and backlog items, LINDDUN for privacy threats, threat models as code, and keeping models current with architecture changes. Use it when designing a new system or feature, or reviewing security architecture."
---

# Skill: Threat Modeling with STRIDE

## Implementation Rules:
- **[MANDATORY]** Threat model every new system, significant feature, and architecture change that touches trust boundaries, sensitive data, authentication, or external integrations, early in design and before implementation is finalized.
- **[MANDATORY]** Start from a data flow diagram: external entities, processes, data stores, data flows, and explicit trust boundaries (internet to edge, service to service, tenant to tenant, admin plane); label flows with protocols, authentication, and data classification.
- **[PATTERN]** Apply STRIDE systematically to each element and flow: Spoofing (authentication), Tampering (integrity), Repudiation (audit), Information disclosure (confidentiality), Denial of service (availability), Elevation of privilege (authorization); use LINDDUN for privacy-specific threats when personal data is involved.
- **[PATTERN]** Answer the four key questions and record them: what are we working on, what can go wrong, what are we going to do about it, and did we do a good job.
- **[PATTERN]** Rate threats consistently (likelihood and impact on a simple scale, or a risk matrix aligned with the organization's risk framework) and focus effort on high-risk threats across trust boundaries.
- **[MANDATORY]** Every accepted threat has a decision: mitigate (with a concrete control and a backlog item with owner), transfer, avoid (change the design), or accept (with an approver and review date); mitigations reference testable security requirements (for example OWASP ASVS items).
- **[PATTERN]** Include abuse cases and attacker goals relevant to the business (fraud, account takeover, data scraping, tenant data access) and misuse of legitimate features, not only technical vulnerabilities.
- **[PATTERN]** Keep threat models as versioned artifacts next to the code or architecture docs (Markdown with diagrams-as-code, OWASP Threat Dragon JSON, or pytm), updated when the architecture or data flows change.
- **[FORBIDDEN]** One-time threat models filed and forgotten, generic threat lists not tied to the system's actual components, and mitigations without owners or verification.
- **[SECURITY]** Consider the supply chain and operations: CI/CD pipelines, third-party SaaS and SDKs, administrative access paths, secrets, backups, and logging systems are part of the attack surface.
- **[TESTING]** Verify mitigations: security tests, SAST/DAST rules, or manual test cases derived from the threat list, and review the threat model during security reviews and after incidents.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
