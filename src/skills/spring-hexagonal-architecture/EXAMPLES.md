# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Domain model coupled to JPA and Spring
```java
package com.acme.shop.order.domain;

import jakarta.persistence.*;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String status; // free-form string: "NEW", "CONFIRMED", "confirmed", "CONFIMED"

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<OrderLine> lines = new ArrayList<>();

    private BigDecimal total;

    public Order() { }

    // public setters: anyone can break the invariants
    public void setStatus(String status) { this.status = status; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public List<OrderLine> getLines() { return lines; }

    @Transactional
    public void confirm() {
        if (lines.isEmpty()) {
            throw new IllegalStateException("empty");
        }
        this.status = "CONFIRMED";
    }
}
```
**Why it's wrong:**
- The domain depends on `jakarta.persistence` and `org.springframework`: it can be neither tested nor evolved without the framework.
- Public setters and a `String` status allow illegal states (a total inconsistent with the lines, arbitrary status values).
- `@Transactional` on an entity method has no effect (the entity is not a proxied bean) and blurs the transactional boundary.
- `FetchType.EAGER` and `IDENTITY` are persistence choices that pollute the business model.

### 2. Controller using repositories and entities directly
```java
package com.acme.shop.order.web;

import com.acme.shop.order.domain.Order;
import com.acme.shop.order.domain.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/orders")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository; // JpaRepository<Order, Long>

    @PostMapping
    public Order create(@RequestBody Order order) {
        BigDecimal total = order.getLines().stream()
                .map(l -> l.getPrice().multiply(BigDecimal.valueOf(l.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setTotal(total);
        order.setStatus("NEW");
        return orderRepository.save(order);
    }

    @PostMapping("/{id}/confirm")
    public Order confirm(@PathVariable Long id) {
        Order order = orderRepository.findById(id).orElseThrow();
        order.confirm();
        return orderRepository.save(order);
    }
}
```
**Why it's wrong:**
- Business logic (the total calculation) lives in the controller and cannot be reused by other adapters (Kafka, batch).
- The JPA entity is used as both input and output: mass assignment, schema exposure, and `LazyInitializationException` during serialization.
- Field injection with `@Autowired` and a direct dependency on the repository violate the dependency rule and hinder testing.
- `orElseThrow()` without a domain exception produces a `NoSuchElementException` translated into a 500.

### 3. Dependency rule not verified automatically
```java
package com.acme.shop.architecture;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class ArchitectureTest {

    // hand-rolled check based on strings in the source files
    @Test
    void domainShouldNotUseSpring() throws IOException {
        try (Stream<Path> files = Files.walk(Path.of("src/main/java/com/acme/shop/order/domain"))) {
            boolean violation = files
                    .filter(p -> p.toString().endsWith(".java"))
                    .anyMatch(p -> {
                        try {
                            return Files.readString(p).contains("import org.springframework");
                        } catch (IOException e) {
                            return false;
                        }
                    });
            assertThat(violation).isFalse();
        }
    }
}
```
**Why it's wrong:**
- It ignores wildcard imports, fully qualified names, and transitive dependencies (e.g., `jakarta.persistence`).
- It covers a single bounded context and verifies neither cycles between packages nor the adapter → application → domain direction.
- I/O errors are silenced by returning `false`, so the test can pass even when it checks nothing.

## Best Practice (How to do it right)

### 1. Domain model coupled to JPA and Spring
```java
package com.acme.shop.order.domain.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class Order {

    private final OrderId id;
    private final CustomerId customerId;
    private final List<OrderLine> lines;
    private OrderStatus status;

    private Order(OrderId id, CustomerId customerId, List<OrderLine> lines, OrderStatus status) {
        this.id = Objects.requireNonNull(id);
        this.customerId = Objects.requireNonNull(customerId);
        this.lines = new ArrayList<>(lines);
        this.status = Objects.requireNonNull(status);
    }

    public static Order place(OrderId id, CustomerId customerId, List<OrderLine> lines) {
        if (lines == null || lines.isEmpty()) {
            throw new EmptyOrderException(id);
        }
        return new Order(id, customerId, lines, OrderStatus.NEW);
    }

    // rehydration from persistence without re-running the creation rules
    public static Order rehydrate(OrderId id, CustomerId customerId, List<OrderLine> lines, OrderStatus status) {
        return new Order(id, customerId, lines, status);
    }

    public void confirm() {
        if (status != OrderStatus.NEW) {
            throw new IllegalOrderTransitionException(id, status, OrderStatus.CONFIRMED);
        }
        this.status = OrderStatus.CONFIRMED;
    }

    public Money total() {
        return lines.stream().map(OrderLine::subtotal).reduce(Money.zero("EUR"), Money::add);
    }

    public OrderId id() { return id; }
    public CustomerId customerId() { return customerId; }
    public OrderStatus status() { return status; }
    public List<OrderLine> lines() { return List.copyOf(lines); }
}

// immutable value object with validation in the compact constructor
record OrderLine(ProductId productId, int quantity, Money unitPrice) {
    OrderLine {
        if (quantity <= 0) throw new IllegalArgumentException("quantity must be positive");
    }
    Money subtotal() { return unitPrice.multiply(BigDecimal.valueOf(quantity)); }
}
```
**Why it's right:**
- No framework dependencies: the domain compiles and is tested with the JDK alone.
- Invariants are protected by factories and behavior methods; the status is an enum and there are no setters.
- The total is derived from the lines, so it cannot diverge; exposed collections are immutable copies.

### 2. Controller using repositories and entities directly
```java
package com.acme.shop.order.adapter.in.web;

import com.acme.shop.order.application.port.in.ConfirmOrderUseCase;
import com.acme.shop.order.application.port.in.PlaceOrderCommand;
import com.acme.shop.order.application.port.in.PlaceOrderUseCase;
import com.acme.shop.order.domain.model.OrderId;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
class OrderController {

    private final PlaceOrderUseCase placeOrder;
    private final ConfirmOrderUseCase confirmOrder;
    private final OrderWebMapper mapper;

    OrderController(PlaceOrderUseCase placeOrder, ConfirmOrderUseCase confirmOrder, OrderWebMapper mapper) {
        this.placeOrder = placeOrder;
        this.confirmOrder = confirmOrder;
        this.mapper = mapper;
    }

    @PostMapping
    ResponseEntity<OrderResponse> place(@Valid @RequestBody PlaceOrderRequest request) {
        PlaceOrderCommand command = mapper.toCommand(request);
        var order = placeOrder.place(command);
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(order.id().value()).toUri();
        return ResponseEntity.created(location).body(mapper.toResponse(order));
    }

    @PostMapping("/{id}/confirmation")
    OrderResponse confirm(@PathVariable UUID id) {
        return mapper.toResponse(confirmOrder.confirm(new OrderId(id)));
    }
}
```
**Why it's right:**
- The controller depends only on inbound ports: the logic lives in the use case and is reusable by any adapter.
- Input and output are validated `record` DTOs, explicitly mapped to commands and responses.
- Constructor injection with a package-private class: no adapter details are exposed.
- `201 Created` with a `Location` header, and `OrderNotFoundException` translated by the `@RestControllerAdvice`.

### 3. Dependency rule not verified automatically
```java
package com.acme.shop.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(packages = "com.acme.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class HexagonalArchitectureTest {

    @ArchTest
    static final ArchRule domain_is_framework_free = noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "jakarta.persistence..", "jakarta.validation..",
                    "org.hibernate..", "com.fasterxml.jackson..")
            .because("the domain must remain pure and framework-independent");

    @ArchTest
    static final ArchRule hexagonal_layers = onionArchitecture()
            .domainModels("..domain.model..")
            .domainServices("..domain.service..")
            .applicationServices("..application..")
            .adapter("web", "..adapter.in.web..")
            .adapter("messaging", "..adapter.in.messaging..", "..adapter.out.messaging..")
            .adapter("persistence", "..adapter.out.persistence..");

    @ArchTest
    static final ArchRule no_cycles_between_contexts = slices()
            .matching("com.acme.shop.(*)..")
            .should().beFreeOfCycles();

    @ArchTest
    static final ArchRule repositories_stay_in_persistence_adapter = noClasses()
            .that().resideOutsideOfPackage("..adapter.out.persistence..")
            .should().dependOnClassesThat()
            .areAssignableTo(org.springframework.data.repository.Repository.class);
}
```
**Why it's right:**
- ArchUnit analyzes bytecode: it catches wildcards, fully qualified names, and every real dependency.
- `onionArchitecture()` verifies the direction of dependencies between domain, application, and adapters.
- The rules cover all bounded contexts, cycles between slices, and the containment of Spring Data repositories.
