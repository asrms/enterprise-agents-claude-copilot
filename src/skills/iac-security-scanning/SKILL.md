---
name: iac-security-scanning
description: "Security scanning of infrastructure as code: Checkov, Trivy config, tfsec rules, KICS, and tflint in pre-commit and CI, secure-by-default cloud configurations (encryption, private networking, least-privilege IAM, logging), secret detection, SARIF reporting, and managed exceptions. Use it when reviewing or securing Terraform, CloudFormation, Bicep, Kubernetes, or Dockerfile code."
---

# Skill: IaC Security Scanning

## Implementation Rules:
- **[MANDATORY]** Scan every IaC change automatically in pre-commit hooks and CI with at least one policy scanner (Checkov, Trivy `config`, or KICS) plus `tflint`; builds fail on high and critical findings, and results are uploaded as SARIF to the code scanning dashboard.
- **[MANDATORY]** Scan the Terraform plan as well as the source (`terraform show -json tfplan | checkov -f -` or `trivy config` on the plan JSON), because values resolved from variables and modules are only visible in the plan.
- **[SECURITY]** Encryption by default: storage, databases, queues, snapshots, and logs are encrypted at rest with KMS keys (customer-managed for sensitive data), and in transit with TLS 1.2+ enforced by policy.
- **[SECURITY]** Private by default: no public buckets or blobs, no databases or caches with public endpoints, security groups without `0.0.0.0/0` on administrative ports (22, 3389) or data ports, and private endpoints/VPC endpoints for cloud services.
- **[SECURITY]** IAM least privilege: no `"Action": "*"` or `"Resource": "*"` for write actions, no inline admin policies on workloads, conditions to scope access (source VPC, organization id, tags), and roles instead of users with access keys.
- **[SECURITY]** Logging and detection are enabled and protected: CloudTrail/Activity Logs/Audit Logs, VPC flow logs, storage access logs, and load balancer logs sent to a central, immutable log account.
- **[FORBIDDEN]** Secrets, passwords, or private keys in IaC source, variable defaults, or `tfvars` committed to Git; use secret managers, generated passwords stored in vaults, or managed identity. Secret detection (gitleaks, trufflehog) runs in pre-commit and CI.
- **[PATTERN]** Exceptions are explicit, justified, and time-bound: inline skip annotations (`#checkov:skip=CKV_AWS_18:Access logs go to central bucket`) or a reviewed baseline file with owner and expiry, never a blanket disable of the scanner.
- **[PATTERN]** Align scanner policies with organization guardrails (CIS benchmarks, internal standards) and complement them with runtime cloud security posture management to catch drift and click-ops.
- **[TESTING]** Policy changes and custom rules are tested with known-good and known-bad fixtures, and the scanners' versions are pinned so results are reproducible.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
