---
name: security-logging-siem
description: "Security logging and detection architecture: which security events to log in applications and infrastructure, structured and consistent event schemas (OCSF, ECS), centralized collection into a SIEM, protection and retention of logs, detection engineering with Sigma rules and tuning, alert triage and SOAR playbooks, cloud audit logs, and privacy in logs. Use it when designing security logging, building detections, or reviewing monitoring coverage."
---

# Skill: Security Logging and SIEM

## Implementation Rules:
- **[MANDATORY]** Log security-relevant events in every application: authentication successes and failures, MFA changes, session creation and revocation, authorization failures, privilege and role changes, access to sensitive records, administrative actions, data exports, input validation failures that indicate attacks, and security configuration changes.
- **[MANDATORY]** Use structured events with a consistent schema (JSON mapped to OCSF or Elastic Common Schema): timestamp in UTC, event type and outcome, actor (user or service id), source IP and user agent, target resource, tenant, request and trace ids, and application version.
- **[FORBIDDEN]** Logging passwords, tokens, session ids, API keys, full payment card numbers, or unnecessary personal data; log messages built by concatenating unsanitized input (log injection); and security events only in human-readable free text.
- **[MANDATORY]** Collect cloud and platform audit logs centrally (AWS CloudTrail organization trail, Azure Activity and Entra sign-in/audit logs, GCP Cloud Audit Logs including Data Access for sensitive services, Kubernetes audit logs, identity provider logs) in a dedicated security account or workspace.
- **[SECURITY]** Protect log integrity and availability: write-once or immutable storage (object lock, immutable workspaces), separate access controls so administrators of monitored systems cannot delete their own logs, and retention that meets legal and investigation needs.
- **[PATTERN]** Build detections as code: Sigma rules or the SIEM's native query language, stored in version control with descriptions, MITRE ATT&CK mapping, severity, false-positive notes, and test data; deploy through CI.
- **[PATTERN]** Prioritize high-signal detections: impossible travel and MFA fatigue patterns, new admin grants, disabled logging or security tools, access key creation, mass downloads or exports, unusual cross-tenant access attempts, and authentication from known malicious infrastructure.
- **[PATTERN]** Every alert has a triage playbook (what to check, how to contain, whom to escalate to), and repetitive response steps are automated with SOAR (enrichment, ticket creation, session revocation with approval).
- **[PERFORMANCE]** Control volume and cost: filter and sample noisy debug logs before the SIEM, route high-volume low-value data to cheaper storage tiers, and keep security events complete rather than sampled.
- **[PATTERN]** Synchronize time (NTP) across systems, and propagate correlation ids end to end so an investigation can follow a request across services.
- **[TESTING]** Validate coverage and detections regularly: unit tests of detection rules against sample events, attack simulations (Atomic Red Team, purple-team exercises) to confirm alerts fire, monitoring for sources that stop sending logs, and review of alert precision.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
