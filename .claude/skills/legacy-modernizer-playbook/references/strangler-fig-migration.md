# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Big-bang rewrite with dual writes
```text
Plan: rewrite the 15-year-old ERP web module in 18 months, feature freeze on the legacy system,
      switch everything on 1 January.
Month 14: new system writes to both the old Oracle schema and the new PostgreSQL database from app code;
          partial failures leave 3% of orders only in one database.
Month 20: cutover postponed twice; business demands features the new system doesn't have yet.
```
**Why it's wrong:**
- Value is delivered only at the end, risk accumulates, and the business is blocked by the freeze.
- Application-level dual writes diverge on failures, and there is no gradual cutover or rollback.

## Best Practice (How to do it right)

### 1. Routing facade with per-capability cutover (NGINX)
```nginx
map $cookie_tenant_cohort $orders_backend {
    default     legacy_erp;
    pilot       orders_service;          # pilot tenants use the new service first
}

upstream legacy_erp     { server erp.internal.example.com:8080; }
upstream orders_service { server orders.internal.example.com:8080; }

server {
    listen 443 ssl;
    location /orders/ {            proxy_pass http://$orders_backend; }   # migrating
    location /invoices/ {          proxy_pass http://orders_service; }    # migrated, legacy code removed
    location / {                   proxy_pass http://legacy_erp; }        # not yet migrated
}
```
### 2. Migration plan for one capability
```text
Capability: order history (read-only first)
1. Characterization tests on legacy responses for 200 sampled orders (golden files)
2. New service with anti-corruption layer mapping legacy status codes (e.g. "ST4") to OrderStatus.SHIPPED
3. CDC from legacy ORDERS tables via Debezium -> Kafka -> new read model (legacy remains source of truth)
4. Shadow traffic: compare responses for 2 weeks; 0.3% differences -> 2 bugs fixed, 1 accepted (date format)
5. Cutover: internal users -> pilot tenants -> 25% -> 100% with rollback via routing map
6. Then migrate writes (order cancellation): new service becomes source of truth; reverse CDC keeps legacy reports working
7. Decommission legacy order history screens and synchronization after 30 days stable
```
**Why it's right:**
- Capabilities move one at a time behind a routing facade, with the legacy system still serving everything else.
- Data flows through CDC with a clear source of truth, equivalence is verified with shadow traffic, and cutover is gradual and reversible.
