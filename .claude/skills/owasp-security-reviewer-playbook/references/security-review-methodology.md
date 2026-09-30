# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Writing up a SQL injection finding
```markdown
## Finding: SQL Injection

**Severity:** Critical

The OrderRepository repository seems vulnerable to SQL injection because
it builds SQL queries by hand. An attacker might be able to
read the database or drop tables.

Semgrep reported: java.lang.security.audit.formatted-sql-string

**File:** OrderRepositoryImpl.java

**Recommended fix:**
- Sanitize user input with replace("'", "''")
- Enable a WAF in front of the application
- Run a penetration test

References: OWASP
```
**Why it's wrong:**
- The mandatory fields are missing: CVSS v3.1 vector, CWE (CWE-89), OWASP category (A03:2021-Injection), `file:line`, confidence; "Critical" is not justified by any vector.
- "Seems" and "might" reveal that the source→sink chain was not verified: it is a transcription of a Semgrep alert, and therefore a potential false positive.
- The remediation is wrong: manual escaping does not protect ORDER BY or numeric contexts, and a WAF is a compensating control, not a fix.
- The impact is generic and does not say who can exploit it (anonymous or authenticated) or which data is exposed, so the team cannot prioritize.

### 2. Executive summary and report overview
```markdown
# Security Review

We analyzed the code with Semgrep and npm audit. The results follow.

## Results
- javascript.express.security.audit.xss.direct-response-write (x37)
- python.lang.security.audit.formatted-sql-query (x12)
- generic.secrets.security.detected-generic-secret (x54)
- java.lang.security.audit.crypto.weak-hash (x3)
- npm audit: 213 vulnerabilities (12 critical, 48 high, 97 moderate, 56 low)
- Possible IDOR in some orders controller
- Content-Security-Policy header missing
- DB password found: Orders2024!Prod

## Conclusions
Overall severity: HIGH.
We recommend updating all dependencies and re-checking the code.
```
**Why it's wrong:**
- Raw tool output without triage: the 54 "secrets" include test fixtures and the 213 npm audit results include undeployed devDependencies; the reader does not know what is real.
- No scope or commit: the report is neither reproducible nor comparable with the next review.
- No go/no-go recommendation and no priorities: "update all dependencies" is not a remediation plan.
- The secret is reported in plaintext, turning the report itself into a credential exposure (CWE-200, A01:2021).

### 3. Automated scanning and triage queue
```bash
#!/usr/bin/env bash
# "quick" scan before the release
cd "$1"

pip install -r requirements.txt
pip-audit > findings.txt

npm install
npm audit >> findings.txt

grep -rn "password" . >> findings.txt
grep -rn "exec(" . >> findings.txt
grep -rn "SELECT" . >> findings.txt

semgrep --config auto . > semgrep.txt

cat findings.txt semgrep.txt > REPORT.md
echo "Report ready: REPORT.md"
```
**Why it's wrong:**
- `pip install` and `npm install` run third-party package install scripts on the reviewer's machine (CWE-829, A08:2021) and modify the environment.
- The greps without exclusions scan `node_modules`, `.git`, `target`: thousands of false positives and real passwords printed in plaintext in the output file.
- `--config auto` requires telemetry to be enabled and uses unversioned rules: the scan is not reproducible and cannot be declared in the methodology.
- The raw output becomes the report: no verification with Read, no recorded commit, no separation between leads and findings.

## Best Practice (How to do it right)

### 1. Writing up a SQL injection finding
```markdown
**SEC-007 — SQL injection in the `sort` parameter of `GET /api/orders/search`**

| Field | Value |
|---|---|
| Severity | **High** — CVSS v3.1 8.8 (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H`) |
| CWE | CWE-89 Improper Neutralization of Special Elements used in an SQL Command |
| OWASP | A03:2021-Injection · ASVS 4.0.3 V5.3.4 |
| Location | `orders-api/src/main/java/com/acme/orders/repo/OrderRepositoryImpl.java:42-45` |
| Confidence | High — `OrderController.java:31` → `OrderService.java:58` → sink verified |

**Evidence**
~~~java
// OrderRepositoryImpl.java:42-45
String sql = "SELECT * FROM orders WHERE customer_id = :cid ORDER BY " + sort + " " + dir;
return em.createNativeQuery(sql, Order.class)
         .setParameter("cid", customerId)
         .getResultList();
~~~
`sort` and `dir` come from `@RequestParam` (`OrderController.java:31`) without validation.

**Impact**
Any authenticated user can inject SQL expressions into the ORDER BY clause and
extract the entire database through boolean inference, including the `users` table.
The DB user `orders_app` owns the schema and the PostgreSQL driver accepts multiple
statements: data modification and deletion are also possible.

**Remediation**
Allowlist of column and direction; no user value concatenated into the SQL text.
~~~java
private static final Map<String, String> SORTABLE = Map.of(
    "createdAt", "created_at", "total", "total_amount");

String column = Optional.ofNullable(SORTABLE.get(sort))
    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "sort not allowed"));
String direction = "asc".equalsIgnoreCase(dir) ? "ASC" : "DESC";
String sql = "SELECT * FROM orders WHERE customer_id = :cid ORDER BY " + column + " " + direction;
~~~
Regression test: a `@WebMvcTest` with `sort=(SELECT 1)` must return `400`.
Defense in depth: revoke schema ownership from `orders_app`.

**References**: OWASP SQL Injection Prevention Cheat Sheet (Allow-list Input Validation),
ASVS 4.0.3 V5.3.4, CWE-89.
```
**Why it's right:**
- All mandatory fields are present and the 8.8 score is consistent with the declared vector (PR:L because an account is needed).
- The evidence is real code with precise lines and the source→sink chain is documented, so High confidence is justified.
- The impact is concrete (who, what, which data) and the remediation is applicable code that uses the correct technique for ORDER BY (allowlist, not a bind parameter).
- The proposed test makes the fix verifiable in CI.

### 2. Executive summary and report overview
```markdown
# Security Review — orders-platform

| Field | Value |
|---|---|
| Commit | `9f3c2e1` (branch `release/2.4`), 2026-09-29 |
| Scope | `orders-api` (Java 21, Spring Boot 3.3), `pricing-worker` (Python 3.12, FastAPI); frontend and Terraform excluded |
| Method | Manual source→sink review, STRIDE on 3 trust boundaries, ASVS 4.0.3 L2 |
| Tools | Semgrep (p/owasp-top-ten, p/java, p/python, p/secrets), Trivy fs, Dependency-Check, pip-audit |

## Executive summary
Release **not recommended** until SEC-001 and SEC-002 are fixed and verified.
An unauthenticated attacker can execute code on the server via the `CART` cookie (SEC-001);
an authenticated customer can read and modify other customers' orders (SEC-002); the worker exposes
IAM credentials via SSRF to the metadata service (SEC-003).
Total: 1 Critical, 2 High, 2 Medium, 1 Low. Of the 146 automated results, 139 were
discarded as false positives or unreachable (Appendix B).

## Findings summary
| ID | Title | Severity | CVSS | CWE | OWASP | Confidence |
|---|---|---|---|---|---|---|
| SEC-001 | Java deserialization of the `CART` cookie | Critical | 9.8 | CWE-502 | A08:2021 | High |
| SEC-002 | IDOR on `GET/PUT /api/orders/{id}` | High | 8.1 | CWE-639 | A01:2021 | High |
| SEC-003 | SSRF to 169.254.169.254 in the price list import | High | 7.7 | CWE-918 | A10:2021 | High |
| SEC-004 | Account enumeration on `/login` | Medium | 5.3 | CWE-204 | A07:2021 | High |
| SEC-005 | Stack traces in 500 responses | Medium | 5.3 | CWE-209 | A05:2021 | High |
| SEC-006 | Session cookie without the `Secure` flag | Low | 3.1 | CWE-614 | A05:2021 | Medium |

## Vulnerable components (A06)
| Component | Version | CVE | Fix | Reachable |
|---|---|---|---|---|
| org.postgresql:postgresql | 42.7.1 | CVE-2024-1597 | 42.7.2 | No: `preferQueryMode` is not `simple` |
| requests | 2.31.0 | CVE-2024-35195 | 2.32.0 | To be verified: `Session` with `verify=False` in `clients.py:18` |

## Remediation priorities
1. SEC-001, SEC-002: hotfix before the release. 2. SEC-003: within 7 days (IMDSv2 immediately).
3. SEC-004, SEC-005, SEC-006 and dependency updates: next sprint.
```
**Why it's right:**
- Scope, commit, and tools with rulesets make the review reproducible and declare what was not analyzed.
- The executive summary is readable by a manager: a go/no-go decision, risks expressed in terms of impact, and triage numbers that build confidence about false positives.
- The table is sorted by severity and every row has CVSS, CWE, OWASP, and confidence; the SCA distinguishes reachable CVEs from non-exploitable ones.
- The remediation priorities separate hotfixes, short-term fixes, and backlog with explicit deadlines.

### 3. Automated scanning and triage queue
```bash
#!/usr/bin/env bash
# read-only scans: no installation, no execution of project code
set -euo pipefail
REPO="${1:?repository path}"
OUT="$REPO/security-reports/raw/$(date +%F)"
mkdir -p "$OUT"
cd "$REPO"
git rev-parse HEAD > "$OUT/commit.txt"
EXCL=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=build
      --exclude-dir=dist --exclude-dir=.venv --exclude-dir=vendor --exclude-dir=security-reports)

# SAST: versioned rulesets and telemetry disabled
semgrep scan --metrics=off --config p/owasp-top-ten --config p/java --config p/python \
  --config p/typescript --config p/secrets --exclude node_modules --exclude target \
  --json --output "$OUT/semgrep.json" .

# per-language sinks: only file:line, confirmation happens with Read
grep -rnE "${EXCL[@]}" --include='*.java' \
  'createNativeQuery\(|Statement\.execute|Runtime\.getRuntime\(\)\.exec|new ObjectInputStream|activateDefaultTyping|DocumentBuilderFactory\.newInstance' \
  . > "$OUT/sinks-java.txt" || true
grep -rnE "${EXCL[@]}" --include='*.py' \
  'shell=True|os\.system\(|pickle\.loads?\(|yaml\.load\(|verify=False|render_template_string\(' \
  . > "$OUT/sinks-python.txt" || true
grep -rnE "${EXCL[@]}" --include='*.ts' --include='*.js' \
  'child_process|execSync\(|eval\(|new Function\(|rejectUnauthorized: *false|dangerouslySetInnerHTML|\$where' \
  . > "$OUT/sinks-node.txt" || true

# SCA (A06) from lockfiles, without running install scripts
trivy fs --scanners vuln,secret,misconfig --format json --output "$OUT/trivy.json" .
if [ -f package-lock.json ]; then
  npm audit --omit=dev --json > "$OUT/npm-audit.json" || true   # exit != 0 if it finds CVEs
fi
if [ -f requirements.txt ]; then
  pip-audit -r requirements.txt --no-deps --disable-pip -f json -o "$OUT/pip-audit.json" || true
fi
if [ -f pom.xml ]; then
  dependency-check.sh --project "$(basename "$REPO")" --scan . --format JSON --out "$OUT"
fi

# sorted triage queue: no result enters the report without manual verification
jq -r '.results[] | [.extra.severity, "\(.path):\(.start.line)", .check_id] | @tsv' \
  "$OUT/semgrep.json" | sort -u > "$OUT/triage-queue.tsv"
echo "Triage: $(wc -l < "$OUT/triage-queue.tsv") Semgrep results to verify"
```
**Why it's right:**
- The recorded commit and the explicit rulesets with `--metrics=off` make the scan reproducible and citable in the methodology section.
- No `install`: SCA works on lockfiles and requirements (`--no-deps --disable-pip`), so no third-party code is executed.
- Vendor exclusions and greps limited to sinks reduce noise; the output is a `file:line` triage queue, not the report.
- Raw artifacts stay separate in `security-reports/raw/`: the final report will contain only findings confirmed with Read, with secrets masked.
