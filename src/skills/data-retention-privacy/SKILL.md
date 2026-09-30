---
name: data-retention-privacy
description: "Privacy-by-design data management for databases: data classification, minimization, retention policies with automated purge, GDPR/CCPA erasure and export, pseudonymization, column and field-level encryption, masking for non-production environments, and audit trails. Use it when storing personal or sensitive data."
---

# Skill: Data Retention and Privacy

## Implementation Rules:
- **[MANDATORY]** Maintain a data inventory: every table/collection and column holding personal or sensitive data is classified (public, internal, confidential, restricted; personal, special category), with owner, purpose, legal basis, and retention period documented next to the schema.
- **[MANDATORY]** Data minimization: collect and store only what the documented purpose requires; do not keep full payloads "just in case", and do not copy personal data into logs, analytics events, caches, or search indexes without the same controls.
- **[MANDATORY]** Retention is enforced by automation, not by policy documents alone: scheduled purge or anonymization jobs, TTL indexes (MongoDB), DynamoDB TTL, partition dropping for time-partitioned tables, and object storage lifecycle rules; each job is monitored and its runs are logged.
- **[PATTERN]** Implement data subject rights as tested features: locate all data for a subject across stores (keyed by a stable subject id), export it in a machine-readable format, and erase or anonymize it, including derived copies, search indexes, caches, and downstream systems via events.
- **[PATTERN]** Backups are covered by the retention design: either backups expire within the retention window, or erasure requests are recorded and re-applied after any restore.
- **[SECURITY]** Encrypt at rest everywhere, and add field-level or application-level encryption (envelope encryption with a KMS) for highly sensitive fields such as national ids, health data, or bank details; keys are rotated and never stored with the data.
- **[PATTERN]** Pseudonymize where identity is not needed: replace direct identifiers with keyed hashes (HMAC with a managed secret) or tokens for analytics and joins; note that pseudonymized data is still personal data, while truly anonymized aggregates are not.
- **[FORBIDDEN]** Production personal data in development, test, or demo environments; use synthetic data or irreversible masking in the copy pipeline. Also forbidden: plaintext secrets or passwords in tables (use strong password hashing such as Argon2id or bcrypt).
- **[SECURITY]** Access to sensitive data follows least privilege: separate database roles, Row-Level Security or views for restricted columns, dynamic data masking for support tools, and break-glass access that is logged and reviewed.
- **[PATTERN]** Audit trails for sensitive operations (who read, changed, exported, or deleted which record, when, and why) are append-only, tamper-evident, and retained according to their own policy.
- **[TESTING]** Tests verify that purge jobs delete exactly the expired records, that erasure removes the subject from every store, and that non-production data sets contain no real personal data (scanner in the masking pipeline).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
