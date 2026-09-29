# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Frozen dependencies until a crisis
```text
- 214 dependencies, median age 4.2 years; Jackson 2.9, Log4j 2.14 (pinned "because it works")
- 63 open Dependabot PRs, oldest from 2023; alerts muted
- Emergency: critical CVE -> upgrade requires jumping 3 majors of the HTTP client used directly in 180 files
```
**Why it's wrong:**
- Deferred updates turn a small routine task into a risky emergency migration.
- Direct usage of the library everywhere multiplies the cost of every change.

## Best Practice (How to do it right)

### 1. Continuous, grouped updates with policy (Renovate)
`renovate.json`:
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard"],
  "schedule": ["before 7am on tuesday"],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    { "matchPackageNames": ["/^org\\.springframework/"], "groupName": "spring" },
    { "matchDepTypes": ["test"], "groupName": "test dependencies", "automerge": true },
    { "matchUpdateTypes": ["major"], "labels": ["major-upgrade"], "dependencyDashboardApproval": true }
  ],
  "vulnerabilityAlerts": { "labels": ["security"], "schedule": ["at any time"] }
}
```
### 2. Adapter isolating an HTTP client (Kotlin)
```kotlin
interface ExchangeRates {                                       // our port: the only API the domain uses
    suspend fun rate(from: Currency, to: Currency): BigDecimal
}

class KtorExchangeRates(private val client: HttpClient, private val baseUrl: String) : ExchangeRates {
    override suspend fun rate(from: Currency, to: Currency): BigDecimal =
        client.get("$baseUrl/rates") { parameter("from", from.currencyCode); parameter("to", to.currencyCode) }
            .body<RateResponse>().rate
}
```
```text
Upgrade record (major): ktor 2.x -> 3.x
- Read migration guide; affected code: KtorExchangeRates + 2 other adapters (3 files)
- Contract tests for adapters pass; deployed with canary; no domain code changed
```
**Why it's right:**
- Updates arrive in small, grouped, scheduled batches with a release-age delay and fast security updates.
- Libraries sit behind adapters, so major upgrades touch a few files and are verified by contract tests.
