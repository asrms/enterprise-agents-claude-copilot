# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Silent breaking change in the same version
```diff
 # /v1/customers/{id} response
 {
-  "name": "Alex Smith",
+  "firstName": "Alex",
+  "lastName": "Smith",
-  "status": "active",
+  "status": "ACTIVE",
   "createdAt": "2024-02-01T10:00:00Z"
 }
```
**Why it's wrong:**
- A field is renamed and enum casing changes without a new version or notice: every existing client breaks on deploy.
- There is no deprecation period, no migration guide, and no way for clients to opt in.

### 2. Removing an endpoint by surprise
```text
Release notes 3.0: "Removed legacy endpoint GET /v1/reports/export."
Monday morning: the finance team's monthly export job fails; nobody knew they used it.
```
**Why it's wrong:**
- Usage was never measured and consumers were never informed; the removal date was not communicated in advance.

## Best Practice (How to do it right)

### 1. Additive change plus a new major version only when needed
```yaml
# v1 stays compatible: new fields are added, old ones deprecated
Customer:
  properties:
    name:
      type: string
      deprecated: true
      description: Deprecated since 2025-03-01, removed with v1 sunset. Use firstName and lastName.
    firstName: { type: string }
    lastName: { type: string }
    status:
      type: string
      enum: [active, suspended]       # casing unchanged in v1
```
```http
HTTP/1.1 200 OK
Deprecation: @1740787200
Sunset: Mon, 01 Dec 2025 00:00:00 GMT
Link: <https://developer.example.com/migrations/customers-v2>; rel="deprecation"; type="text/html"
```
**Why it's right:**
- v1 clients keep working while new fields are available; v2 can introduce the new enum casing.
- The deprecation and removal dates are machine-readable in headers and documented in the migration guide.

### 2. Removing an endpoint by surprise
```text
1. 2025-01-10  Mark GET /v1/reports/export deprecated (OpenAPI + Deprecation/Sunset headers, sunset 2025-07-01)
2. 2025-01-10  Dashboard: calls per client id to the deprecated endpoint (weekly)
3. 2025-02-01  Email + developer portal notice to the 3 client ids still calling it, with migration guide
4. 2025-05-15  Remaining caller: finance-batch → migrated with the team, confirmed by zero calls for 30 days
5. 2025-07-01  Endpoint removed; changelog entry under "Removed"
```
**Why it's right:**
- Usage data drives the removal; consumers get time, instructions, and direct contact; the removal is documented.
