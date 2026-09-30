# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. N+1 and pagination with fetch join on a collection
```java
package com.acme.shop.order.adapter.out.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

interface OrderJpaRepository extends JpaRepository<OrderEntity, Long> {

    // fetch join on a collection + Pageable: in-memory pagination (HHH90003004)
    @Query("select o from OrderEntity o join fetch o.lines where o.customer.id = :customerId")
    Page<OrderEntity> findByCustomer(Long customerId, Pageable pageable);
}

@Service
class OrderReportService {

    private final OrderJpaRepository repository;

    OrderReportService(OrderJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public List<String> lastOrdersLabels() {
        return repository.findAll().stream()          // 1 query, every row in the table
                .map(o -> o.getCustomer().getName()   // +1 query per order (N+1)
                        + " - " + o.getLines().size()) // +1 query per collection
                .toList();
    }
}
```
**Why it's wrong:**
- `join fetch` on a collection with `Pageable` makes Hibernate load every row and paginate in memory: OOM on large tables.
- `findAll()` with neither a filter nor pagination, plus access to lazy associations in the loop, generates 1 + 2N queries.
- A read-write transaction for a read: useless dirty checking and snapshots on every loaded entity.

### 2. Batch insert with IDENTITY and saveAll without flush/clear
```java
package com.acme.billing.adapter.out.persistence;

import jakarta.persistence.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "invoice_line")
class InvoiceLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // disables JDBC insert batching
    private Long id;

    private String sku;
    private BigDecimal amount;

    protected InvoiceLineEntity() { }

    InvoiceLineEntity(String sku, BigDecimal amount) {
        this.sku = sku;
        this.amount = amount;
    }
}

@Component
class InvoiceLineImporter {

    private final InvoiceLineJpaRepository repository;

    InvoiceLineImporter(InvoiceLineJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void importAll(List<InvoiceLineRecord> records) { // 500,000 rows
        for (InvoiceLineRecord r : records) {
            repository.save(new InvoiceLineEntity(r.sku(), r.amount())); // 1 round trip per row
        }
        // the persistence context holds 500,000 entities until commit
    }
}
```
**Why it's wrong:**
- With `IDENTITY`, Hibernate must execute every `INSERT` immediately to obtain the id: no batching is possible.
- Without `hibernate.jdbc.batch_size`, every row is a separate network round trip.
- Without periodic `flush()`/`clear()`, the persistence context grows without bound and the final dirty check becomes O(N).

### 3. Entity with Lombok @Data, EAGER, and no @Version
```java
package com.acme.shop.customer.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data // generates equals/hashCode/toString over all fields, collections included
@Entity
@Table(name = "customer")
public class CustomerEntity {

    @Id
    @GeneratedValue
    private Long id;

    private String email;

    private String loyaltyTier;

    @ManyToOne // default EAGER
    private CompanyEntity company;

    @OneToMany(mappedBy = "customer", fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    private List<AddressEntity> addresses = new ArrayList<>();

    @ManyToMany(cascade = CascadeType.ALL) // deleting a customer deletes the shared segments
    private List<SegmentEntity> segments = new ArrayList<>();
}
```
**Why it's wrong:**
- `@Data` uses mutable fields and lazy collections in `equals`/`hashCode`/`toString`: accidental initialization, infinite recursion, and a hash that changes after `persist`.
- The implicitly EAGER `@ManyToOne` and `EAGER` on the collection load entire graphs on every read.
- `CascadeType.ALL` on `@ManyToMany` propagates `REMOVE` to shared entities.
- Without `@Version`, concurrent updates silently overwrite each other (lost update).

## Best Practice (How to do it right)

### 1. N+1 and pagination with fetch join on a collection
```java
package com.acme.shop.order.adapter.out.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

interface OrderJpaRepository extends JpaRepository<OrderEntity, Long> {

    // 1) paginate on ids only (separate, lightweight count query)
    @Query(value = "select o.id from OrderEntity o where o.customer.id = :customerId",
           countQuery = "select count(o) from OrderEntity o where o.customer.id = :customerId")
    Page<Long> findIdsByCustomer(Long customerId, Pageable pageable);

    // 2) load the required graph for the ids of the page
    @EntityGraph(attributePaths = {"customer", "lines"})
    @Query("select o from OrderEntity o where o.id in :ids")
    List<OrderEntity> findWithLinesByIdIn(List<Long> ids);

    // list/report: DTO projection, no managed entities
    @Query(value = """
           select new com.acme.shop.order.adapter.out.persistence.OrderSummaryRow(
                  o.id, c.name, o.status, size(o.lines))
           from OrderEntity o join o.customer c
           where c.id = :customerId
           """,
           countQuery = "select count(o) from OrderEntity o where o.customer.id = :customerId")
    Page<OrderSummaryRow> findSummaries(Long customerId, Pageable pageable);
}

record OrderSummaryRow(Long id, String customerName, OrderStatus status, Integer lineCount) { }

class OrderQueryAdapter {

    private final OrderJpaRepository repository;

    OrderQueryAdapter(OrderJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    Page<OrderEntity> pageForCustomer(Long customerId, Pageable pageable) {
        Page<Long> ids = repository.findIdsByCustomer(customerId, pageable);
        List<OrderEntity> orders = repository.findWithLinesByIdIn(ids.getContent());
        return new PageImpl<>(orders, pageable, ids.getTotalElements());
    }
}
```
**Why it's right:**
- Pagination happens in SQL on the ids; the graph fetch uses `IN` on the ids of the current page only: a constant number of queries (3).
- The report uses a `record` projection with a constructor expression: no dirty checking and no proxies.
- `readOnly = true` reduces the cost of the persistence context. Note: the order of `findWithLinesByIdIn` must be realigned with `ids` if the `Sort` is significant.

### 2. Batch insert with IDENTITY and saveAll without flush/clear
```java
package com.acme.billing.adapter.out.persistence;

import jakarta.persistence.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "invoice_line")
class InvoiceLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "invoice_line_seq")
    @SequenceGenerator(name = "invoice_line_seq", sequenceName = "invoice_line_seq", allocationSize = 50)
    private Long id; // the DB sequence must have INCREMENT BY 50

    private String sku;
    private BigDecimal amount;

    protected InvoiceLineEntity() { }

    InvoiceLineEntity(String sku, BigDecimal amount) {
        this.sku = sku;
        this.amount = amount;
    }
}

@Component
class InvoiceLineImporter {

    private static final int BATCH_SIZE = 50; // = hibernate.jdbc.batch_size

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void importChunk(List<InvoiceLineRecord> chunk) { // chunks of ~10,000 rows per transaction
        for (int i = 0; i < chunk.size(); i++) {
            InvoiceLineRecord r = chunk.get(i);
            entityManager.persist(new InvoiceLineEntity(r.sku(), r.amount()));
            if ((i + 1) % BATCH_SIZE == 0) {
                entityManager.flush(); // sends the JDBC batch
                entityManager.clear(); // releases the persistence context
            }
        }
    }
}
// associated application.yml:
// spring.datasource.url=jdbc:postgresql://db:5432/billing?reWriteBatchedInserts=true
// spring.jpa.properties.hibernate.jdbc.batch_size=50
// spring.jpa.properties.hibernate.order_inserts=true
// spring.jpa.properties.hibernate.order_updates=true
```
**Why it's right:**
- `SEQUENCE` with the pooled optimizer (`allocationSize = 50`) generates ids in memory and enables batching.
- `flush()`/`clear()` every 50 items keeps memory constant; chunks limit the duration of each transaction.
- `order_inserts` and `reWriteBatchedInserts` maximize the effective batch size on PostgreSQL.

### 3. Entity with Lombok @Data, EAGER, and no @Version
```java
package com.acme.shop.customer.adapter.out.persistence;

import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Entity
@Table(name = "customer")
class CustomerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "customer_seq")
    @SequenceGenerator(name = "customer_seq", sequenceName = "customer_seq", allocationSize = 50)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false)
    private String email; // immutable natural key

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id")
    private CompanyEntity company;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<AddressEntity> addresses = new HashSet<>();

    protected CustomerEntity() { }

    void addAddress(AddressEntity address) {
        addresses.add(address);
        address.setCustomer(this); // keeps both sides in sync
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CustomerEntity other)) return false;
        return email != null && email.equals(other.email);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(email);
    }

    @Override
    public String toString() {
        return "CustomerEntity[id=" + id + ", version=" + version + "]";
    }
}
```
**Why it's right:**
- All associations are LAZY, and cascading applies only to the parent → child composition with `orphanRemoval`.
- `equals`/`hashCode` on the immutable natural key: stable before and after `persist`, without touching lazy collections.
- `@Version` enables optimistic locking; `toString()` does not traverse associations.
