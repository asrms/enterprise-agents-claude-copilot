---
name: dast-zap
description: "Dynamic application security testing with OWASP ZAP and complementary tools: baseline, full, and API scans against running environments, authenticated scanning, OpenAPI and GraphQL imports, scan policies and rule tuning, running DAST safely in CI against ephemeral environments, triaging results, and combining DAST with SAST and manual testing. Use it when setting up or reviewing dynamic security testing of web applications and APIs."
---

# Skill: DAST with OWASP ZAP

## Implementation Rules:
- **[ARCHITECTURE]** Run DAST against a deployed, production-like environment (ephemeral preview or staging) with realistic configuration (TLS, headers, WAF settings as in production), never against production without explicit authorization and a passive-only profile.
- **[PATTERN]** Use the right scan type: ZAP baseline scan (passive, fast) on every deployment of a preview environment; API scan (`zap-api-scan.py` with the OpenAPI, SOAP, or GraphQL definition) for APIs; full active scans on a schedule or before major releases.
- **[MANDATORY]** Scan authenticated: configure ZAP authentication (context with login, header-based bearer tokens, or scripts) using dedicated test accounts for each role, so protected functionality and authorization boundaries are covered; verify that the scan stayed logged in.
- **[PATTERN]** Seed the scan with complete attack surface: import the OpenAPI definition, run a crawler plus the AJAX spider for single-page applications, or replay recorded end-to-end test traffic through ZAP as a proxy.
- **[MANDATORY]** Maintain a versioned rules configuration (`-c zap-rules.tsv` or Automation Framework plan) that sets each rule to FAIL, WARN, or IGNORE with justification, so builds fail on meaningful findings only.
- **[PATTERN]** Prefer the ZAP Automation Framework (a YAML plan with environment, contexts, authentication, jobs, and reports) for repeatable scans in CI, stored with the application code.
- **[SECURITY]** Protect test environments during scanning: isolated data, no real customer data, disabled outbound email and payment integrations, and rate limits adjusted so scans do not trigger lockouts that hide results.
- **[FORBIDDEN]** Active scans against production or third-party services without written authorization, treating a clean baseline scan as proof of security, and ignoring findings because they "only" affect staging configuration that mirrors production.
- **[PATTERN]** Complement DAST with targeted tools and manual testing: TLS configuration checks, security header checks, authorization testing across roles and tenants (IDOR), and periodic penetration tests for high-risk applications.
- **[PATTERN]** Correlate DAST findings with SAST and SCA results and deduplicate them in a vulnerability management system, attaching request and response evidence for developers.
- **[TESTING]** Validate the scanner setup periodically against a deliberately vulnerable application (OWASP Juice Shop or an internal test app) to confirm authentication, crawling, and key rules work.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
