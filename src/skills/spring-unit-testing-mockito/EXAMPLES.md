# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unit test of a use case with a Spring context and mocked value objects
```java
package com.acme.shop.order.application;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest // starts the entire context (DB, Kafka, security) to test one class
class PlaceOrderServiceTest {

    @Autowired
    PlaceOrderService service;

    @MockBean // deprecated since Spring Boot 3.4, removed in Boot 4
    SaveOrderPort saveOrderPort;

    @MockBean
    LoadCustomerPort loadCustomerPort;

    @Test
    void test1() {
        Money price = mock(Money.class);                  // mock of a value object
        when(price.amount()).thenReturn(new BigDecimal("10.00"));
        Customer customer = mock(Customer.class);
        when(loadCustomerPort.load(any())).thenReturn(customer);
        when(saveOrderPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Order order = service.place(new PlaceOrderCommand(
                CustomerId.random(), List.of(new OrderLineCommand(ProductId.random(), 2, price))));

        assertEquals("NEW", order.status().name());
        verify(loadCustomerPort, times(1)).load(any()); // verifying an already-stubbed query
        verify(saveOrderPort).save(any());               // no check on the saved content
    }
}
```
**Why it's wrong:**
- `@SpringBootTest` makes the test slow (seconds instead of milliseconds) and dependent on infrastructure.
- Mocks of `Money` and `Customer`: the test verifies the stubs, not the real behavior of the value objects.
- `verify` on stubbed queries and `any()` everywhere do not verify what is saved; the name `test1` is meaningless.

### 2. Verifying side effects with any() and non-deterministic time
```java
package com.acme.billing.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceReminderServiceTest {

    @Mock InvoiceQueryPort invoices;
    @Mock ReminderNotificationPort notifications;
    @InjectMocks InvoiceReminderService service; // fails silently if the constructor changes

    @Test
    void shouldSendReminders() {
        Invoice overdue = Invoice.issue(InvoiceId.random(), Instant.now().minus(31, ChronoUnit.DAYS));
        lenient().when(invoices.findOpen()).thenReturn(java.util.List.of(overdue)); // lenient to "make the test pass"
        lenient().when(invoices.findPaid()).thenReturn(java.util.List.of());        // stub never used

        int sent = service.sendReminders(); // internally uses Instant.now()

        assertTrue(sent > 0);
        verify(notifications, atLeastOnce()).send(any(), any());
    }
}
```
**Why it's wrong:**
- `Instant.now()` in the test and in the code makes the result depend on when it runs (flaky at the 30-day boundary).
- `lenient()` hides useless stubs that strictness would have reported.
- `assertTrue(sent > 0)` and `send(any(), any())` do not verify the recipient, the invoice, or the reminder content.

### 3. Persistence and async tests with H2 and Thread.sleep
```java
package com.acme.shop.order.adapter.out.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@DirtiesContext // recreates the context for every class: an ever slower build
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:test;MODE=PostgreSQL", // dialect different from production
        "spring.jpa.hibernate.ddl-auto=create-drop"               // schema different from the Flyway migrations
})
class OrderPersistenceAdapterIT {

    @Autowired OrderPersistenceAdapter adapter;
    @Autowired OrderProjectionUpdater projectionUpdater;

    @Test
    void saveAndProject() throws InterruptedException {
        Order order = OrderFixtures.newOrder();
        adapter.save(order);

        projectionUpdater.refreshAsync(order.id());
        Thread.sleep(3000); // too long locally, too short in CI

        assertTrue(adapter.findSummary(order.id()).isPresent());
        assertEquals(2, adapter.findSummary(order.id()).get().lineCount());
    }
}
```
**Why it's wrong:**
- H2 in compatibility mode does not reproduce PostgreSQL's types, locks, `SKIP LOCKED`, JSONB, and indexes: bugs surface in production.
- `ddl-auto=create-drop` does not validate the real Flyway migrations.
- `Thread.sleep` makes the test slow and flaky; `@DirtiesContext` defeats the context cache.

## Best Practice (How to do it right)

### 1. Unit test of a use case with a Spring context and mocked value objects
```java
package com.acme.shop.order.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class) // STRICT_STUBS by default
class PlaceOrderServiceTest {

    @Mock LoadCustomerPort loadCustomerPort;
    @Mock SaveOrderPort saveOrderPort;
    @Captor ArgumentCaptor<Order> orderCaptor;

    private PlaceOrderService sut;

    @BeforeEach
    void setUp() {
        sut = new PlaceOrderService(loadCustomerPort, saveOrderPort);
    }

    @Test
    void shouldPlaceNewOrderWithComputedTotal_whenCustomerIsActive() {
        // given
        Customer customer = CustomerFixtures.activeCustomer(); // real object, not a mock
        given(loadCustomerPort.load(customer.id())).willReturn(customer);
        var command = new PlaceOrderCommand(customer.id(), List.of(
                new OrderLineCommand(ProductId.of("SKU-1"), 2, Money.eur("10.00")),
                new OrderLineCommand(ProductId.of("SKU-2"), 1, Money.eur("5.50"))));

        // when
        sut.place(command);

        // then
        then(saveOrderPort).should().save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertThat(saved.status()).isEqualTo(OrderStatus.NEW);
        assertThat(saved.total()).isEqualTo(Money.eur("25.50"));
        assertThat(saved.lines()).extracting(OrderLine::productId)
                .containsExactly(ProductId.of("SKU-1"), ProductId.of("SKU-2"));
    }
}
```
**Why it's right:**
- No Spring context: the test runs in milliseconds and the class is built explicitly, as in production.
- Real value objects and aggregates; only the outbound ports owned by the service are mocked.
- `ArgumentCaptor` + AssertJ verify the content actually saved; the name describes behavior and condition.

### 2. Verifying side effects with any() and non-deterministic time
```java
package com.acme.billing.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class InvoiceReminderServiceTest {

    private static final Instant NOW = Instant.parse("2025-03-31T08:00:00Z");

    @Mock InvoiceQueryPort invoices;
    @Mock ReminderNotificationPort notifications;

    private InvoiceReminderService sut;

    @BeforeEach
    void setUp() {
        sut = new InvoiceReminderService(invoices, notifications, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void shouldRemindOnlyInvoicesOverdueMoreThan30Days() {
        // given
        Invoice overdue = InvoiceFixtures.openInvoice("INV-001", NOW.minusSeconds(31 * 86_400));
        Invoice recent = InvoiceFixtures.openInvoice("INV-002", NOW.minusSeconds(29 * 86_400));
        given(invoices.findOpen()).willReturn(List.of(overdue, recent));

        // when
        int sent = sut.sendReminders();

        // then
        assertThat(sent).isEqualTo(1);
        then(notifications).should().send(overdue.customerId(), new ReminderMessage(overdue.id(), 31));
        then(notifications).shouldHaveNoMoreInteractions();
    }
}
```
**Why it's right:**
- `Clock.fixed` makes the test deterministic and explicitly covers the 30-day boundary.
- Strict stubs without `lenient()`: every stub is necessary; explicit construction instead of `@InjectMocks`.
- Precise verification of recipient and message, plus `shouldHaveNoMoreInteractions()` to rule out unwanted sends.

### 3. Persistence and async tests with H2 and Thread.sleep
```java
package com.acme.shop.order.adapter.out.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@SpringBootTest
@Testcontainers
class OrderPersistenceAdapterIT {

    @Container
    @ServiceConnection // Spring Boot 3.1+: configures spring.datasource.* from the container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired OrderPersistenceAdapter adapter;
    @Autowired OrderProjectionUpdater projectionUpdater;

    @Test
    void shouldExposeOrderSummary_whenProjectionIsRefreshedAsynchronously() {
        // given: schema created by the real Flyway migrations, ddl-auto=validate
        Order order = OrderFixtures.newOrderWithLines(2);
        adapter.save(order);

        // when
        projectionUpdater.refreshAsync(order.id());

        // then
        await().atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(100))
                .untilAsserted(() -> assertThat(adapter.findSummary(order.id()))
                        .hasValueSatisfying(s -> assertThat(s.lineCount()).isEqualTo(2)));
    }
}
```
**Why it's right:**
- Real PostgreSQL via Testcontainers and `@ServiceConnection`: same dialect, same migrations, no manual properties.
- Awaitility waits only as long as needed, with an explicit maximum timeout: a fast and stable test.
- No `@DirtiesContext`: the context and the `static` container are reused across tests.
