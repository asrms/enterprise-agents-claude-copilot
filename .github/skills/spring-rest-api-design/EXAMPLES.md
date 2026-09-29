# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Controller with entities, verbs in the path, and wrong status codes
```java
package com.acme.shop.customer.web;

import com.acme.shop.customer.persistence.CustomerEntity;
import com.acme.shop.customer.persistence.CustomerJpaRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class CustomerController {

    private final CustomerJpaRepository repository;

    public CustomerController(CustomerJpaRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/getAllCustomers")
    public List<CustomerEntity> getAll() {
        return repository.findAll(); // no pagination, entities serialized with their associations
    }

    @PostMapping("/createCustomer")
    public CustomerEntity create(@RequestBody CustomerEntity customer) { // the client can set id, role, balance
        return repository.save(customer); // 200 OK instead of 201 Created
    }

    @GetMapping("/customer")
    public CustomerEntity get(@RequestParam Long id) {
        return repository.findById(id).orElse(null); // 200 with an empty body instead of 404
    }

    @PostMapping("/deleteCustomer/{id}")
    public String delete(@PathVariable Long id) {
        repository.deleteById(id);
        return "OK"; // a string instead of 204 No Content
    }
}
```
**Why it's wrong:**
- Verbs in the path and `POST` for deletion violate HTTP semantics and confuse caches and proxies.
- Entities as input allow mass assignment; as output they expose the schema and cause `LazyInitializationException`.
- Wrong statuses (`200` on creation, `200` + `null` for a missing resource) and no validation or versioning.

### 2. Non-standard error handling in the controller
```java
package com.acme.shop.order.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<Map<String, Object>> confirm(@PathVariable String id) {
        Map<String, Object> body = new HashMap<>();
        try {
            orderService.confirm(id);
            body.put("success", true);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            body.put("success", false);
            body.put("error", e.getMessage());         // technical/SQL messages to the client
            body.put("trace", e.getStackTrace());      // exposed stack trace
            return ResponseEntity.ok(body);            // 200 even on error
        }
    }
}
```
**Why it's wrong:**
- Every controller invents a different error format: clients cannot handle errors uniformly.
- `200 OK` with `success=false` breaks monitoring, retries, and HTTP semantics.
- `catch (Exception)` conflates business errors and bugs and leaks internal messages and stack traces.

### 3. Non-idempotent payment POST
```java
package com.acme.billing.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentGatewayClient gateway;
    private final PaymentRepository repository;

    public PaymentController(PaymentGatewayClient gateway, PaymentRepository repository) {
        this.gateway = gateway;
        this.repository = repository;
    }

    @PostMapping
    public ResponseEntity<PaymentEntity> pay(@RequestBody PaymentRequest request) {
        // a client-side timeout followed by a retry charges the customer twice
        String chargeId = gateway.charge(request.cardToken(), request.amount());
        PaymentEntity payment = new PaymentEntity(request.orderId(), request.amount(), chargeId);
        return ResponseEntity.ok(repository.save(payment));
    }
}

record PaymentRequest(String orderId, String cardToken, BigDecimal amount) { }
```
**Why it's wrong:**
- Without an `Idempotency-Key` every network retry or double click produces a new charge.
- No validation (a negative or null `amount` is accepted) and business logic in the controller.
- Returns the entity and `200` instead of a DTO with `201 Created` and `Location`.

## Best Practice (How to do it right)

### 1. Controller with entities, verbs in the path, and wrong status codes
```java
package com.acme.shop.customer.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
class CustomerController {

    private final CustomerUseCases customers; // inbound port
    private final CustomerWebMapper mapper;

    CustomerController(CustomerUseCases customers, CustomerWebMapper mapper) {
        this.customers = customers;
        this.mapper = mapper;
    }

    @GetMapping
    PageResponse<CustomerSummaryResponse> list(@PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return PageResponse.from(customers.list(pageable).map(mapper::toSummary));
    }

    @GetMapping("/{customerId}")
    CustomerResponse get(@PathVariable UUID customerId) {
        return mapper.toResponse(customers.get(new CustomerId(customerId))); // 404 via advice
    }

    @PostMapping
    ResponseEntity<CustomerResponse> create(@Valid @RequestBody CreateCustomerRequest request) {
        var created = customers.register(mapper.toCommand(request));
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id().value()).toUri();
        return ResponseEntity.created(location).body(mapper.toResponse(created));
    }

    @DeleteMapping("/{customerId}")
    ResponseEntity<Void> delete(@PathVariable UUID customerId) {
        customers.deactivate(new CustomerId(customerId));
        return ResponseEntity.noContent().build();
    }
}

// no server-managed fields (id, role, balance) in the request
record CreateCustomerRequest(@NotBlank @Size(max = 100) String fullName,
                             @NotBlank @Email @Size(max = 254) String email) { }
```
**Why it's right:**
- A versioned plural resource, semantic HTTP methods, and correct statuses (`201` + `Location`, `204`, `404` via advice).
- Validated `record` DTOs separate the contract from the internal model and eliminate mass assignment.
- A paginated collection with defaults and a stable page DTO; the controller delegates everything to the use case.

### 2. Non-standard error handling in the controller
```java
package com.acme.shop.shared.adapter.in.web;

import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.util.List;

@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final String BASE = "https://api.acme.com/problems/";

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail handleNotFound(OrderNotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "order-not-found", "Order not found", ex.getMessage());
    }

    @ExceptionHandler(IllegalOrderTransitionException.class)
    ProblemDetail handleBusinessRule(IllegalOrderTransitionException ex) {
        ProblemDetail pd = problem(HttpStatus.UNPROCESSABLE_ENTITY, "illegal-order-transition",
                "Order state does not allow this operation", ex.getMessage());
        pd.setProperty("currentStatus", ex.currentStatus().name());
        return pd;
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleConcurrentUpdate() {
        return problem(HttpStatus.CONFLICT, "concurrent-update", "Resource was modified concurrently",
                "Reload the resource and retry the operation");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "validation-error", "Invalid request",
                "One or more fields are invalid");
        List<FieldViolation> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new FieldViolation(fe.getField(), fe.getDefaultMessage()))
                .toList();
        pd.setProperty("errors", errors);
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setType(URI.create(BASE + type));
        pd.setTitle(title);
        return pd;
    }

    record FieldViolation(String field, String message) { }
}
```
**Why it's right:**
- A single RFC 9457 format for all APIs, with a stable `type` and extended properties (`errors`, `currentStatus`).
- Semantic statuses (`404`, `422`, `409`, `400`) and controllers free of `try/catch`.
- Unmapped exceptions fall back to standard handling without exposing stack traces or technical messages.

### 3. Non-idempotent payment POST
```java
package com.acme.billing.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
class PaymentController {

    private final CapturePaymentUseCase capturePayment;

    PaymentController(CapturePaymentUseCase capturePayment) {
        this.capturePayment = capturePayment;
    }

    @PostMapping
    ResponseEntity<PaymentResponse> capture(@RequestHeader("Idempotency-Key") UUID idempotencyKey,
                                            @Valid @RequestBody CapturePaymentRequest request) {
        // the use case stores (key, payload hash, response) with a UNIQUE constraint and a 24h TTL:
        // replay -> same response; same key with a different payload -> IdempotencyKeyReusedException (422)
        PaymentResult result = capturePayment.capture(
                new CapturePaymentCommand(idempotencyKey, request.orderId(), request.cardToken(), request.amount()));
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(result.paymentId()).toUri();
        return ResponseEntity.created(location)
                .header("Idempotent-Replayed", String.valueOf(result.replayed()))
                .body(PaymentResponse.from(result));
    }
}

record CapturePaymentRequest(@NotNull UUID orderId,
                             @NotBlank String cardToken,
                             @NotNull @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount) { }
```
**Why it's right:**
- The mandatory `Idempotency-Key` makes retries and double submissions safe: the charge happens only once.
- Key handling (atomic persistence, hash comparison, TTL) lives in the use case, not in the controller.
- Input validated with precise constraints on the amount, a `201` response with `Location`, and a dedicated DTO.
