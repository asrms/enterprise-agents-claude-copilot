# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unstructured logs with secrets and missing events
```text
2026-09-29 10:14:03 login ok for user jdoe token=eyJhbGciOiJSUzI1NiJ9...     <- token in logs
2026-09-29 10:14:09 ERROR something failed                                  <- no context
(no log entry when jdoe was granted the admin role; app servers can delete their own log files)
```
**Why it's wrong:**
- A bearer token in logs lets anyone with log access impersonate the user.
- Security-relevant actions such as role changes are missing, events cannot be correlated, and attackers can erase traces.

## Best Practice (How to do it right)

### 1. Structured security event (application)
```json
{
  "time": "2026-09-29T10:14:03.512Z",
  "class_name": "Account Change",
  "activity_name": "Assign Privileges",
  "status": "Success",
  "severity": "Medium",
  "actor": { "user": { "uid": "u-1842", "type": "Admin" }, "session": { "uid_hash": "sha256:5e1f0b2c" } },
  "user": { "uid": "u-2291" },
  "privileges": ["orders:admin"],
  "src_endpoint": { "ip": "203.0.113.24" },
  "metadata": { "product": { "name": "shop-admin", "version": "7.3.4" }, "correlation_uid": "req-8f41c2" },
  "tenant_id": "t-17"
}
```
### 2. Detection as code (Sigma)
```yaml
title: Admin Privilege Granted Outside Change Window
id: 3f6a2c1e-8d4b-4f5e-9a7c-2b1d0e9f8a61
status: stable
description: Detects assignment of admin privileges in the shop admin application outside business hours.
tags: [attack.persistence, attack.t1098]
logsource: { product: shop-admin, category: account_change }
detection:
  selection:
    activity_name: Assign Privileges
    status: Success
    privileges|contains: ':admin'
  timeframe_filter:
    time|re: 'T(0[0-5]|2[2-3]):'
  condition: selection and timeframe_filter
falsepositives: [Planned emergency changes documented in the change calendar]
level: high
```
**Why it's right:**
- Events follow a schema with actor, target, outcome, and correlation id; secrets are replaced by hashes.
- Privilege changes are logged, and a versioned, ATT&CK-mapped detection with documented false positives alerts on risky grants.
