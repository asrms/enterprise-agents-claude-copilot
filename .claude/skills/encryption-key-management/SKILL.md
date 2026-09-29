---
name: encryption-key-management
description: "Encryption and key management architecture: encryption in transit with TLS 1.2+/1.3 and mTLS, encryption at rest with cloud KMS and customer-managed keys, envelope encryption, HSMs, key hierarchy and separation of duties, rotation and crypto-periods, application-level and field-level encryption, certificate lifecycle automation, secrets vs keys, and crypto agility including post-quantum readiness. Use it when designing or reviewing how data and keys are protected."
---

# Skill: Encryption and Key Management

## Implementation Rules:
- **[MANDATORY]** Encrypt all data in transit with TLS 1.2 or 1.3 using modern cipher suites (no SSL, TLS 1.0/1.1, or export ciphers), including internal service-to-service and database connections; certificate validation is never disabled.
- **[MANDATORY]** Encrypt all data at rest (storage, databases, backups, snapshots, queues, logs) using the platform's KMS; use customer-managed keys for confidential and restricted data so access to keys can be controlled, audited, and revoked independently of the data.
- **[ARCHITECTURE]** Use envelope encryption: data encryption keys (DEKs) encrypt data and are themselves encrypted by key encryption keys (KEKs) held in a KMS or HSM that never exports them; applications use SDKs such as AWS Encryption SDK, Google Tink, or cloud client-side encryption libraries rather than raw primitives.
- **[PATTERN]** Add application-level or field-level encryption for the most sensitive attributes (national ids, health data, payment references, secrets in databases) so database administrators and backups do not see plaintext, with deterministic encryption or keyed hashes only where equality search is required.
- **[MANDATORY]** Separate duties: key administrators cannot read data, data users cannot manage or delete keys, key policies grant usage to specific workload identities, and key deletion requires a waiting period and approval.
- **[PATTERN]** Rotate keys on a defined crypto-period (automatic KMS rotation, typically yearly for KEKs), re-encrypt or re-wrap data when policy requires, and design data formats to include key identifiers and algorithm versions for crypto agility.
- **[PATTERN]** Automate certificate lifecycle: issuance and renewal through ACME (cert-manager, cloud certificate managers) or an internal PKI with short-lived certificates, inventory of all certificates, and alerts well before expiry.
- **[FORBIDDEN]** Custom cryptographic algorithms or protocols, ECB mode, unauthenticated encryption (use AEAD such as AES-GCM or ChaCha20-Poly1305), reused nonces, MD5/SHA-1 for security purposes, hard-coded keys, and keys stored in the same place as the data they protect.
- **[SECURITY]** Store secrets (passwords, API tokens) in a secret manager and cryptographic keys in a KMS/HSM; hash passwords with Argon2id, scrypt, or bcrypt with appropriate parameters, never with fast hashes or reversible encryption.
- **[PATTERN]** Prepare for post-quantum migration: inventory algorithms and key sizes in use, prefer TLS stacks and libraries that support hybrid post-quantum key exchange (ML-KEM) as they become available, and prioritize long-lived confidential data.
- **[MANDATORY]** Log and monitor key usage and administrative actions (KMS audit logs) and alert on unusual decrypt volumes, policy changes, and scheduled key deletions.
- **[TESTING]** Verify configurations with automated checks (TLS scanners such as testssl.sh, cloud posture rules for encryption and CMK usage), and test key rotation and key-loss recovery procedures in non-production environments.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
