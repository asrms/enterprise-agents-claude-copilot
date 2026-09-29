# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. README that helps nobody
```text
# project-x
[20 badges]
Internal tool. Run it like usual.
TODO: write docs
Set API_KEY=sk_live_51H... and run ./start.sh (only works on Linux with my aliases)
```
**Why it's wrong:**
- It does not say what the project does or for whom, and the instructions depend on the author's environment.
- It contains a real secret, and missing sections are left as TODOs.

## Best Practice (How to do it right)

### 1. Well-structured service README (excerpt)
~~~markdown
# orders-api

Order management API for the web shop and mobile apps. Owns order placement, cancellation, and order history.
Owner: team-orders (#orders-dev) · Runbooks: [docs/runbooks](docs/runbooks) · Dashboard: [Grafana](https://grafana.example.com/d/orders)

## Quick start

Prerequisites: Docker 27+, Java 21, Make.

```bash
git clone https://github.com/example/orders-api.git
cd orders-api
make up            # starts PostgreSQL and the API on http://localhost:8080
curl -s http://localhost:8080/actuator/health   # {"status":"UP"}
```

## Configuration

| Variable              | Required | Default | Description                              |
|-----------------------|----------|---------|------------------------------------------|
| `DATABASE_URL`        | yes      | -       | JDBC URL of the orders database          |
| `ORDERS_PAGE_SIZE`    | no       | `50`    | Default page size for order listings     |
| `PAYMENTS_BASE_URL`   | yes      | -       | Base URL of the payments service         |

## Development

- Run tests: `make test` (unit) and `make it` (integration with Testcontainers)
- API contract: [api/openapi.yaml](api/openapi.yaml)
- Architecture decisions: [docs/adr](docs/adr)

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Apache-2.0
~~~
**Why it's right:**
- Purpose, owner, and support links come first; the quick start is copyable and states the expected result.
- Configuration is complete and scannable, details are linked rather than duplicated, and no secrets appear.
