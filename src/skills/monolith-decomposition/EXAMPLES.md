# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Distributed monolith
```text
Extracted in 3 months: orders-service, customers-service, billing-service, inventory-service
All four still read and write the same "shop" PostgreSQL database with cross-table joins
Placing an order: orders -> customers -> inventory -> billing -> customers (synchronous HTTP, 5 hops)
Shared library "shop-domain" (entities for everything) must be released before any service deploys
```
**Why it's wrong:**
- Services are coupled through tables, synchronous chains, and a shared domain library, so they cannot change or deploy independently.
- The system has the complexity of distribution without its benefits, and failures cascade.

## Best Practice (How to do it right)

### 1. Modular monolith with enforced boundaries (Spring Modulith)
```text
com.example.shop
├── orders      (api: OrderManagement, events: OrderPlaced)     schema: orders
├── billing     (api: Invoicing, listens: OrderPlaced)          schema: billing
├── inventory   (api: StockReservations)                        schema: inventory
└── customers   (api: CustomerDirectory)                        schema: customers
```
```java
class ModularityTests {
    ApplicationModules modules = ApplicationModules.of(ShopApplication.class);

    @Test
    void verifiesModuleBoundaries() {
        modules.verify();          // fails on access to another module's internal packages or cyclic dependencies
    }
}

@Service
class Invoicing {
    @ApplicationModuleListener                 // transactional, asynchronous event handling with an event publication registry
    void on(OrderPlaced event) {
        invoices.createFor(event.orderId(), event.total());
    }
}
```
### 2. Extraction plan for billing (only module with a justified need to split)
```text
Reason: billing must scale independently at month-end and is owned by a separate team with its own release cadence.
1. Billing already owns schema "billing"; remove the last 2 cross-schema joins (use OrderPlaced event data instead).
2. Externalize OrderPlaced via transactional outbox -> Kafka topic orders.order-placed.v1 (contract-tested).
3. Deploy billing-service consuming the topic; run in parallel and compare invoices for 2 billing cycles.
4. Route invoice APIs to billing-service; move schema to its own database via logical replication; decommission module.
```
**Why it's right:**
- Boundaries are established and enforced inside the monolith first, with data ownership per schema and event-based collaboration.
- Only a module with a concrete reason is extracted, using the outbox, contract tests, and parallel run before cutover.
