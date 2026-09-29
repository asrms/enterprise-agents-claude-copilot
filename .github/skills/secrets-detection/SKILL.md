---
name: secrets-detection
description: "Preventing and responding to leaked secrets: pre-commit and CI secret scanning with Gitleaks, TruffleHog, or platform push protection, scanning full Git history and build artifacts, custom patterns for internal tokens, verified-secret prioritization, the leak response runbook (revoke, rotate, audit, clean up), and replacing static secrets with short-lived credentials. Use it when setting up secret scanning or handling an exposed credential."
---

# Skill: Secrets Detection

## Implementation Rules:
- **[MANDATORY]** Block secrets before they land: enable platform push protection (GitHub secret scanning push protection, GitLab secret push protection) and a pre-commit hook (Gitleaks or TruffleHog) for every repository, with CI scanning as the enforcing backstop.
- **[MANDATORY]** Scan the full Git history when onboarding a repository and periodically afterwards, plus build outputs that could embed secrets (container images, mobile and frontend bundles, logs, and public artifacts).
- **[PATTERN]** Add custom detection patterns for internal token formats (prefix-based tokens such as `acme_live_...`), and design your own tokens with recognizable prefixes and checksums so scanners can detect them reliably.
- **[PATTERN]** Prioritize verified findings: use tools that check whether a detected credential is live (TruffleHog verification, provider validity checks) and route active secrets to immediate response.
- **[MANDATORY]** Treat every leaked secret as compromised: revoke or rotate it first (within minutes to hours by severity), then check the provider's access logs for misuse, then remove it from code and history as cleanup; deleting the commit is never the fix.
- **[FORBIDDEN]** Secrets in source code, configuration files, `.env` files committed to Git, CI variables printed in logs, Docker image layers (`ENV` or `ARG` with secrets), and chat or ticket systems; also forbidden is adding broad allow-list entries to silence scanners.
- **[PATTERN]** Manage false positives narrowly: allow-list specific fingerprints or test fixtures (clearly fake values in `testdata/`) in the scanner configuration with a comment, reviewed like code.
- **[SECURITY]** Reduce the number of static secrets: workload identity and OIDC federation for CI and cloud access, managed identities, short-lived database credentials from a vault, and automatic rotation for remaining secrets.
- **[PATTERN]** Store necessary secrets in a secret manager (Vault, AWS Secrets Manager, Azure Key Vault, Google Secret Manager) with access policies per workload, audit logging, and rotation, injected at runtime rather than baked into images.
- **[PATTERN]** Track secret incidents with metrics (time to revoke, recurrence by team or repository) and use them to target training and tooling.
- **[TESTING]** Verify the controls: canary test secrets (fake but pattern-matching) prove that hooks, CI scanning, and push protection block commits; rotation procedures are rehearsed for critical secrets.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
