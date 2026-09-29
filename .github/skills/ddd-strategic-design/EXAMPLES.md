# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Services split by entity with a shared canonical model
```text
customer-service   → CRUD on customers table
product-service    → CRUD on products table
order-service      → CRUD on orders table, calls customer-service and product-service synchronously
shared-model.jar   → Customer, Product, Order classes used by every service (48 fields each)
shared database    → all services read each other's tables "for performance"
```
**Why it's wrong:**
- Every business change (e.g. a new pricing rule) touches several services and the shared JAR: a distributed monolith.
- The shared model mixes concepts from different contexts (Product = catalog description + price + stock), so no team owns it.
- Shared tables couple deployments and make schema changes impossible without coordinating all teams.

### 2. External model leaking into the core domain
```java
// Pricing domain uses the ERP's types directly
public Money priceFor(SapMaterialMasterRecord material, SapCustomerRecordV2 customer) {
    if ("Z4".equals(customer.getKdgrp()) && material.getMtart().startsWith("FERT")) { ... }
}
```
**Why it's wrong:**
- ERP codes (`KDGRP`, `MTART`) become part of the pricing language; any ERP change breaks the core domain.

## Best Practice (How to do it right)

### 1. Services split by entity with a shared canonical model
```text
Subdomains
  Core:        Pricing & Promotions, Order Fulfillment orchestration
  Supporting:  Catalog, Customer Accounts
  Generic:     Payments (Stripe), Identity (Keycloak), Email (provider)

Bounded contexts and ownership
  Catalog (team Discovery)      Product = descriptive content, categories, media
  Pricing (team Pricing)        PricedItem = SKU + price lists + promotions
  Ordering (team Checkout)      Order aggregate: lines, totals, status; invariants on totals
  Fulfillment (team Logistics)  Shipment = parcels, carrier, tracking

Context map
  Catalog  --[OHS/PL: product events v1]-->  Pricing, Ordering
  Pricing  --[Customer–Supplier, OHS: GET /quotes]--> Ordering
  Ordering --[PL: OrderPlaced v2 (integration event)]--> Fulfillment
  Payments (Stripe) --[ACL in Ordering]--> Ordering
  Each context owns its database; no shared tables.
```
**Why it's right:**
- Boundaries follow language and ownership; each context has its own model of "product" suited to its job.
- Relationships use explicit patterns and published contracts, so teams can change internals independently.

### 2. External model leaking into the core domain
```java
// ACL at the boundary: ERP concepts are translated into the Pricing language
final class ErpCustomerTranslator {
    CustomerSegment segmentOf(SapCustomerRecordV2 record) {
        return switch (record.getKdgrp()) {
            case "Z4" -> CustomerSegment.WHOLESALE;
            case "Z1", "Z2" -> CustomerSegment.RETAIL;
            default -> CustomerSegment.STANDARD;
        };
    }
}

// Pricing domain: only its own ubiquitous language
public Money priceFor(ProductKind kind, CustomerSegment segment) {
    if (segment == CustomerSegment.WHOLESALE && kind == ProductKind.FINISHED_GOOD) { ... }
}
```
**Why it's right:**
- The Anticorruption Layer isolates ERP codes; the domain speaks in business terms and survives ERP changes.
