# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Configuration scattered with @Value and dangerous defaults
```java
package com.acme.billing.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class InvoiceService {

    @Value("${billing.invoice.payment-term-days:30}")
    private int paymentTermDays;

    @Value("${billing.invoice.sender:noreply@localhost}") // development default ends up in production
    private String sender;

    @Value("${billing.sdi.url:http://localhost:8089}")
    private String sdiUrl;

    @Value("${billing.sdi.password:changeit}") // secret with a default in the code
    private String sdiPassword;

    private final Environment environment;

    public InvoiceService(Environment environment) {
        this.environment = environment;
    }

    public Invoice issue(Order order) {
        int retries = Integer.parseInt(environment.getProperty("billing.sdi.retries", "3"));
        if (environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod"))) {
            // different business logic per profile
            return Invoice.issueElectronic(order, paymentTermDays, sender, sdiUrl, sdiPassword, retries);
        }
        return Invoice.issueDraft(order, paymentTermDays);
    }
}
```
**Why it's wrong:**
- Scattered, untyped properties: no validation, no metadata, typos discovered only at runtime.
- The defaults (`localhost`, `changeit`) mask missing configuration and bring secrets into the source.
- Business branching on the `prod` profile: production behavior is not tested in the other environments.

### 2. High-cardinality metrics and unstructured logs
```java
package com.acme.shop.order.application;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
class PlaceOrderService implements PlaceOrderUseCase {

    private static final Logger log = LoggerFactory.getLogger(PlaceOrderService.class);

    private final MeterRegistry registry;
    private final SaveOrderPort saveOrderPort;

    PlaceOrderService(MeterRegistry registry, SaveOrderPort saveOrderPort) {
        this.registry = registry;
        this.saveOrderPort = saveOrderPort;
    }

    @Override
    public Order place(PlaceOrderCommand command) {
        long start = System.currentTimeMillis();
        Order order = saveOrderPort.save(Order.place(OrderId.random(), command.customerId(), command.lines()));
        // one time series per customer and per order
        registry.counter("orders_placed", "customerId", command.customerId().toString(),
                "orderId", order.id().toString()).increment();
        registry.timer("placeOrderTime").record(java.time.Duration.ofMillis(System.currentTimeMillis() - start));
        // concatenation, personal data, and no correlation id
        log.info("Order placed: " + order.id() + " by " + command.customerEmail()
                + " card=" + command.cardNumber());
        return order;
    }
}
```
**Why it's wrong:**
- The `customerId`/`orderId` tags create millions of time series: Prometheus degrades or runs out of memory.
- Inconsistent names (`orders_placed`, `placeOrderTime`) and manual time measurement instead of the Observation API.
- Logs with concatenation, email, and card number (GDPR/PCI violation) and without a `traceId`.

### 3. Health checks and shutdown unsuitable for Kubernetes
```yaml
# application.yml
server:
  shutdown: immediate              # in-flight requests interrupted on every rolling update

management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    health:
      show-details: always
  health:
    defaults:
      enabled: true

# deployment.yaml (excerpt)
# livenessProbe:
#   httpGet: { path: /actuator/health, port: 8080 }   # includes DB, Kafka, external services
#   periodSeconds: 5
#   failureThreshold: 1
# readinessProbe:
#   httpGet: { path: /actuator/health, port: 8080 }
# terminationGracePeriodSeconds: 5                     # shorter than the drain time

logging:
  level:
    root: DEBUG
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE     # parameter values (personal data) in the logs
  pattern:
    console: "%d %-5level %logger - %msg%n"  # free text, no traceId
```
**Why it's wrong:**
- Liveness on `/actuator/health` includes the DB: a database outage restarts every pod (cascading failure).
- `shutdown: immediate` and a 5 s grace period truncate in-flight requests during deploys.
- Full Actuator exposure, `DEBUG`/`TRACE` logs with SQL parameters, and an unstructured format in production.

## Best Practice (How to do it right)

### 1. Configuration scattered with @Value and dangerous defaults
```java
package com.acme.billing.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "billing")
public record BillingProperties(@NotNull @Valid Invoice invoice, @NotNull @Valid Sdi sdi) {

    public record Invoice(@NotNull Duration paymentTerm,
                          @NotBlank @Email String sender) { }

    public record Sdi(@NotNull URI url,
                      @NotBlank String username,
                      @NotBlank String password,             // from env BILLING_SDI_PASSWORD or Vault
                      @DefaultValue("3") @Min(0) @Max(10) int retries,
                      @DefaultValue("5s") Duration timeout) {

        @Override
        public String toString() {
            return "Sdi[url=" + url + ", username=" + username + ", password=****, retries="
                    + retries + ", timeout=" + timeout + "]";
        }
    }
}

// Application: @SpringBootApplication @ConfigurationPropertiesScan
// application.yml (versioned):
//   billing.invoice.payment-term: 30d
//   billing.invoice.sender: invoices@acme.com
//   billing.sdi.url: ${BILLING_SDI_URL}
//   billing.sdi.username: ${BILLING_SDI_USERNAME}
//   billing.sdi.password: ${BILLING_SDI_PASSWORD}
// The service receives BillingProperties (or one of its records) via the constructor; no branching on the profile:
// the difference between environments is a real or fake SDI adapter chosen in the configuration.
```
**Why it's right:**
- Typed configuration (`Duration`, `URI`, bounded `int`) validated at startup: fail fast if a value is missing.
- No defaults for URLs and secrets, which come from environment variables or Vault; `toString()` masks the password.
- A single configuration point documented by the `spring-boot-configuration-processor` metadata.

### 2. High-cardinality metrics and unstructured logs
```java
package com.acme.shop.order.application;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.observation.annotation.Observed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
class PlaceOrderService implements PlaceOrderUseCase {

    private static final Logger log = LoggerFactory.getLogger(PlaceOrderService.class);

    private final SaveOrderPort saveOrderPort;
    private final MeterRegistry registry;

    PlaceOrderService(SaveOrderPort saveOrderPort, MeterRegistry registry) {
        this.saveOrderPort = saveOrderPort;
        this.registry = registry;
    }

    @Override
    @Observed(name = "orders.place", contextualName = "place-order") // timer + span, requires an ObservedAspect bean
    public Order place(PlaceOrderCommand command) {
        Order order = saveOrderPort.save(Order.place(OrderId.random(), command.customerId(), command.lines()));
        Counter.builder("orders.placed")
                .description("Orders placed")
                .tag("channel", command.channel().name()) // low, bounded cardinality (enum)
                .register(registry)
                .increment();
        // parameterized, no personal data; traceId/spanId added to MDC by Micrometer Tracing
        log.info("Order {} placed with {} lines", order.id().value(), order.lines().size());
        return order;
    }
}

// application.yml:
//   spring.application.name: order-service
//   logging.structured.format.console: ecs                        # Spring Boot 3.4+
//   management.metrics.tags.application: ${spring.application.name}
//   management.tracing.sampling.probability: 0.1
//   management.otlp.tracing.endpoint: http://otel-collector:4318/v1/traces
//   management.tracing.baggage.remote-fields: x-correlation-id
//   management.tracing.baggage.correlation.fields: x-correlation-id
```
**Why it's right:**
- Low-cardinality tags only (`channel` from an enum); ids travel in spans and logs, not in metrics.
- `@Observed` produces consistent Micrometer timers and tracing spans with a single annotation.
- ECS JSON logs with `traceId`, `spanId`, and `x-correlation-id` in MDC, parameterized and free of PII.

### 3. Health checks and shutdown unsuitable for Kubernetes
```yaml
# application.yml
server:
  shutdown: graceful                       # default since Spring Boot 3.4, made explicit for clarity

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s

management:
  server:
    port: 8081                             # management port not exposed by the ingress
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true
      show-details: when-authorized
      group:
        liveness:
          include: livenessState           # only the application's internal state
        readiness:
          include: readinessState,db       # dependencies essential to serve traffic
  info:
    git:
      mode: simple

logging:
  structured:
    format:
      console: ecs                         # Spring Boot 3.4+
  level:
    root: INFO

# deployment.yaml (excerpt)
# livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: 8081 }, periodSeconds: 10, failureThreshold: 3 }
# readinessProbe: { httpGet: { path: /actuator/health/readiness, port: 8081 }, periodSeconds: 5 }
# lifecycle.preStop: { sleep: { seconds: 5 } }   # Kubernetes 1.30+, otherwise exec "sleep 5"
# terminationGracePeriodSeconds: 45              # > preStop + timeout-per-shutdown-phase
```
**Why it's right:**
- Separate liveness and readiness: a DB problem removes the pod from load balancing without restarting it.
- Graceful shutdown coordinated with `preStop` and the grace period: in-flight requests complete during rolling updates.
- Minimal Actuator on a dedicated port and structured logs at `INFO` level.
