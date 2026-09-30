# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. @Async with self-invocation and an unconfigured executor
```java
package com.acme.billing.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.Future;

@EnableAsync
@Service
public class InvoiceService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceService.class);

    private final InvoicePdfRenderer renderer;
    private final InvoiceMailer mailer;

    public InvoiceService(InvoicePdfRenderer renderer, InvoiceMailer mailer) {
        this.renderer = renderer;
        this.mailer = mailer;
    }

    public void closeMonth(List<InvoiceId> invoices) {
        for (InvoiceId id : invoices) {
            sendInvoice(id); // self-invocation: the proxy is bypassed, synchronous execution
        }
    }

    @Async // no explicit executor, no exception handling
    public Future<Void> sendInvoice(InvoiceId id) {
        log.info("Sending invoice {}", id); // MDC (traceId, userId) lost in the async thread
        byte[] pdf = renderer.render(id);
        synchronized (this) {               // virtual thread pinning during I/O
            mailer.send(id, pdf);
        }
        return null;
    }
}
```
**Why it's wrong:**
- `sendInvoice` called from `closeMonth` in the same class does not go through the proxy: nothing is asynchronous.
- An implicit executor and a raw `Future` returning `null`: no control over pool, queue, and errors.
- MDC and `SecurityContext` are not propagated; `synchronized` around I/O blocks the carrier thread on JDK 21.

### 2. Publishing to Kafka inside the transaction (dual write)
```java
package com.acme.shop.order.application;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ConfirmOrderService implements ConfirmOrderUseCase {

    private final LoadOrderPort loadOrder;
    private final SaveOrderPort saveOrder;
    private final KafkaTemplate<String, OrderConfirmedMessage> kafka;

    ConfirmOrderService(LoadOrderPort loadOrder, SaveOrderPort saveOrder,
                        KafkaTemplate<String, OrderConfirmedMessage> kafka) {
        this.loadOrder = loadOrder;
        this.saveOrder = saveOrder;
        this.kafka = kafka;
    }

    @Override
    @Transactional
    public Order confirm(OrderId id) {
        Order order = loadOrder.load(id);
        order.confirm();
        saveOrder.save(order);
        // if the commit fails after sending, consumers see an order that was never confirmed;
        // if the app crashes after the commit but before sending, the event is lost
        kafka.send("orders.confirmed", new OrderConfirmedMessage(id.value(), order.total().amount()));
        return order;
    }
}
```
**Why it's wrong:**
- The DB and the broker do not share the transaction: a rollback does not undo the already-sent message.
- A crash between commit and `send` silently loses the event; the result of `send` is not even checked.
- A message without a key: no ordering guarantee per order.

### 3. Non-idempotent Kafka consumer without retry or DLT
```java
package com.acme.shop.payment.adapter.in.messaging;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
class PaymentCapturedListener {

    private final LoyaltyService loyaltyService;
    private final ShipmentClient shipmentClient;

    PaymentCapturedListener(LoyaltyService loyaltyService, ShipmentClient shipmentClient) {
        this.loyaltyService = loyaltyService;
        this.shipmentClient = shipmentClient;
    }

    @KafkaListener(topics = "payments.captured", groupId = "shop")
    void on(PaymentCapturedMessage message) {
        try {
            loyaltyService.addPoints(message.customerId(), message.amount()); // doubles the points on duplicates
            shipmentClient.requestShipment(message.orderId());                // duplicate shipment
        } catch (Exception e) {
            // swallowed error: offset committed and message lost
            System.err.println("Failed " + message.orderId() + ": " + e.getMessage());
        }
    }
}
```
**Why it's wrong:**
- Kafka guarantees at-least-once: a rebalance or a retry redelivers the message and duplicates the effects.
- The swallowed exception makes the offset commit: no retry, no DLT, silent loss.
- `System.err` instead of the logger: no correlation id and no error metrics.

## Best Practice (How to do it right)

### 1. @Async with self-invocation and an unconfigured executor
```java
package com.acme.billing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.task.DelegatingSecurityContextAsyncTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadPoolExecutor;

@EnableAsync
@Configuration
class AsyncConfig {

    @Bean
    ThreadPoolTaskExecutor invoiceThreadPool() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(200); // bounded queue
        executor.setThreadNamePrefix("invoice-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy()); // backpressure
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator()); // MDC + tracing (Spring 6.1+)
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        return executor;
    }

    @Bean
    DelegatingSecurityContextAsyncTaskExecutor invoiceExecutor(ThreadPoolTaskExecutor invoiceThreadPool) {
        return new DelegatingSecurityContextAsyncTaskExecutor(invoiceThreadPool);
    }
}

// separate bean: a call from another bean goes through the @Async proxy
@Component
class InvoiceDispatcher {

    private final InvoicePdfRenderer renderer;
    private final InvoiceMailer mailer;

    InvoiceDispatcher(InvoicePdfRenderer renderer, InvoiceMailer mailer) {
        this.renderer = renderer;
        this.mailer = mailer;
    }

    @Async("invoiceExecutor")
    public CompletableFuture<InvoiceId> send(InvoiceId id) {
        mailer.send(id, renderer.render(id)); // InvoiceMailer uses ReentrantLock, not synchronized
        return CompletableFuture.completedFuture(id);
    }
}
```
**Why it's right:**
- A dedicated executor with a bounded queue, `CallerRunsPolicy` backpressure, and orderly shutdown.
- `ContextPropagatingTaskDecorator` propagates MDC and trace; the `DelegatingSecurityContextAsyncTaskExecutor` wrapper propagates the `SecurityContext`.
- The async method lives in a separate bean and returns a `CompletableFuture`, composable with `orTimeout`/`exceptionally`.

### 2. Publishing to Kafka inside the transaction (dual write)
```java
package com.acme.shop.order.application;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ConfirmOrderService implements ConfirmOrderUseCase {

    private final LoadOrderPort loadOrder;
    private final SaveOrderPort saveOrder;
    private final OutboxPort outbox; // writes to outbox_event in the same transaction

    ConfirmOrderService(LoadOrderPort loadOrder, SaveOrderPort saveOrder, OutboxPort outbox) {
        this.loadOrder = loadOrder;
        this.saveOrder = saveOrder;
        this.outbox = outbox;
    }

    @Override
    @Transactional
    public Order confirm(OrderId id) {
        Order order = loadOrder.load(id);
        order.confirm();
        saveOrder.save(order);
        order.pullEvents().forEach(event ->
                outbox.append("orders.confirmed", order.id().value().toString(), event)); // key = orderId
        return order; // atomic commit: aggregate + event
    }
}

// in the real project the relay lives in the out.messaging adapter
@Component
class OutboxRelay {

    private final OutboxJpaRepository repository;
    private final KafkaTemplate<String, String> kafka;

    OutboxRelay(OutboxJpaRepository repository, KafkaTemplate<String, String> kafka) {
        this.repository = repository;
        this.kafka = kafka;
    }

    @Scheduled(fixedDelayString = "${outbox.relay.delay:PT1S}")
    @SchedulerLock(name = "outboxRelay", lockAtMostFor = "PT1M")
    @Transactional
    public void publishPending() {
        // native query with FOR UPDATE SKIP LOCKED, limit 100
        for (OutboxEventEntity e : repository.lockNextBatch(100)) {
            kafka.send(e.getTopic(), e.getMessageKey(), e.getPayload()).join(); // waits for the ack (acks=all)
            e.markPublished();
        }
    }
}
```
**Why it's right:**
- The aggregate and the event are written in the same transaction: no lost or phantom events.
- The relay publishes only after the commit, waits for the broker's ack, and marks the event; possible duplicates are handled by idempotent consumers.
- Key = `orderId` guarantees per-aggregate ordering; ShedLock prevents concurrent relays across instances.

### 3. Non-idempotent Kafka consumer without retry or DLT
```java
package com.acme.shop.payment.adapter.in.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.retry.annotation.Backoff; // Spring Kafka 3.x (spring-retry)
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.ValidationException;

@Component
class PaymentCapturedListener {

    private static final Logger log = LoggerFactory.getLogger(PaymentCapturedListener.class);

    private final ProcessedMessageRepository processed; // UNIQUE(message_id)
    private final CompletePaymentUseCase completePayment;

    PaymentCapturedListener(ProcessedMessageRepository processed, CompletePaymentUseCase completePayment) {
        this.processed = processed;
        this.completePayment = completePayment;
    }

    @RetryableTopic(attempts = "4",
                    backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 30000),
                    exclude = {ValidationException.class, DeserializationException.class})
    @KafkaListener(topics = "payments.captured", groupId = "shop-payments")
    @Transactional
    void on(PaymentCapturedMessage message, @Header("eventId") String eventId) {
        if (!processed.markIfAbsent(eventId)) { // INSERT INTO processed_message(message_id) VALUES (?) ON CONFLICT DO NOTHING
            log.info("Duplicate event {} ignored", eventId);
            return;
        }
        completePayment.complete(message.orderId(), message.amount()); // same transaction as the marker
    }

    @DltHandler
    void onDlt(PaymentCapturedMessage message, @Header(KafkaHeaders.EXCEPTION_MESSAGE) String error) {
        log.error("Payment event for order {} moved to DLT: {}", message.orderId(), error);
    }
}
```
**Why it's right:**
- The `processed_message` marker and the business effect are in the same transaction: duplicates are discarded.
- `@RetryableTopic` applies non-blocking retries with exponential backoff; non-recoverable errors go straight to the DLT.
- Exceptions are not swallowed: the offset advances only after success or routing to the DLT; `@DltHandler` records the outcome.
