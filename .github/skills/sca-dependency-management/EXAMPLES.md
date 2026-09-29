# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Floating versions, no lock file, public-first resolution
```json
{
  "dependencies": {
    "express": "*",
    "company-auth-client": "^1.0.0"
  }
}
```
```text
.npmrc: registry=https://registry.npmjs.org/      # internal name "company-auth-client" can be claimed on the public registry
CI: npm install                                    # resolves new versions on every build, runs all install scripts
```
**Why it's wrong:**
- Builds are not reproducible and can pull a compromised new release at any time.
- An unscoped internal package name resolved against the public registry enables dependency confusion.

## Best Practice (How to do it right)

### 1. Scoped packages, private registry, locked and scanned installs
`.npmrc`:
```ini
@company:registry=https://npm.internal.example.com/
registry=https://npm-proxy.internal.example.com/
ignore-scripts=true
```
```bash
npm ci
npm rebuild esbuild sharp                               # allow install scripts only for vetted packages
npm audit signatures                                    # verify registry signatures and provenance
osv-scanner scan source --lockfile=package-lock.json --format sarif --output osv.sarif
npx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json
```
### 2. Renovate configuration
`renovate.json`:
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard"],
  "schedule": ["before 6am on monday"],
  "vulnerabilityAlerts": { "enabled": true, "schedule": ["at any time"], "labels": ["security"] },
  "packageRules": [
    { "matchUpdateTypes": ["minor", "patch"], "matchCurrentVersion": "!/^0/", "groupName": "non-major dependencies", "automerge": true },
    { "matchUpdateTypes": ["major"], "dependencyDashboardApproval": true },
    { "matchPackageNames": ["/^@company\\//"], "groupName": "internal packages" }
  ],
  "minimumReleaseAge": "3 days"
}
```
**Why it's right:**
- Internal packages resolve only from the private registry, public packages come through a proxy, and install scripts are opt-in.
- Installs are reproducible from the lock file, signatures are verified, vulnerabilities are scanned, and an SBOM is produced.
- Updates arrive continuously in reviewable groups, with security fixes immediately and a short release-age delay against compromised releases.
