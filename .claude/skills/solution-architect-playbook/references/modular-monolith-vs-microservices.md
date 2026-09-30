# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Distributed monolith from day one
```text
Team of 6 developers, product not yet launched, 14 services:
  user-svc, profile-svc, address-svc, cart-svc, cart-item-svc, order-svc, order-line-svc, price-svc,
  tax-svc, discount-svc, stock-svc, notification-svc, pdf-svc, gateway
- One shared PostgreSQL database; order-svc joins cart and price tables directly
- Placing an order = gateway → order-svc → cart-svc → price-svc → tax-svc → discount-svc → stock-svc (sync HTTP)
- All services released together "to avoid incompatibilities"
```
**Why it's wrong:**
- Services split single aggregates (order vs order-line) and must be deployed together: all costs of distribution, none of the autonomy.
- A 6-hop synchronous chain multiplies latency and makes any single failure break checkout.
- A shared database couples every schema change across services.

### 2. "Modular" monolith without enforced boundaries
```java
// billing module reaching into ordering internals
import com.acme.ordering.internal.OrderJpaRepository;

@Service
class InvoiceService {
    private final OrderJpaRepository orders;   // direct access to another module's persistence
    ...
}
```
**Why it's wrong:**
- Nothing prevents cross-module dependencies, so the modules erode into a big ball of mud and cannot be extracted later.

## Best Practice (How to do it right)

### 1. Distributed monolith from day one
```text
Decision (ADR-0003): modular monolith, 4 modules aligned to bounded contexts
  catalog | ordering | billing | fulfillment
- One deployable, one database with a schema per module, no cross-schema joins
- Modules communicate via public APIs and in-process domain events (outbox-backed)
- Extraction criteria recorded: extract "fulfillment" when the logistics team is created
  or when its batch workload needs independent scaling

18 months later: fulfillment extracted (ADR-0017) with the Strangler Fig pattern
- OrderPlaced events already existed → published to RabbitMQ instead of in-process
- fulfillment schema moved to its own database; no code in other modules changed
```
**Why it's right:**
- The team gets fast delivery and simple operations first, with boundaries ready for later extraction.
- Extraction happens for a documented driver, and because data and communication were already separated, it was cheap.

### 2. "Modular" monolith without enforced boundaries (Spring Modulith / ArchUnit)
```java
@Test
void modulesRespectBoundaries() {
    ApplicationModules.of(ShopApplication.class).verify();   // fails on access to another module's internals
}

@ArchTest
static final ArchRule no_cross_module_persistence =
    noClasses().that().resideInAPackage("..billing..")
        .should().dependOnClassesThat().resideInAPackage("..ordering.internal..");
```
```java
// billing uses the ordering module's public API
@Service
class InvoiceService {
    private final OrderQueries orders;   // com.acme.ordering.api — published interface of the module
    ...
}
```
**Why it's right:**
- Module rules are executable tests, so boundary violations fail the build.
- Billing depends on a published interface, not on ordering's persistence, keeping the modules independent.
