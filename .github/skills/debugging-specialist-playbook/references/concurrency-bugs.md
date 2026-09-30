# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Check-then-act across instances, "fixed" with a local lock
```java
@Service
public class CouponService {
    public synchronized void redeem(String code, String customerId) {      // lock only within one JVM
        Coupon coupon = repository.findByCode(code);
        if (coupon.getUses() < coupon.getMaxUses()) {                       // check
            coupon.setUses(coupon.getUses() + 1);                           // act (lost update across instances)
            repository.save(coupon);
            orders.applyDiscount(customerId, coupon);
        }
    }
}
```
**Why it's wrong:**
- With several instances, two requests can read the same count and both redeem; `synchronized` does not help across processes.
- The invariant (uses never exceed max uses) is not enforced where the data lives.

## Best Practice (How to do it right)

### 1. Atomic conditional update at the source of truth
```java
public interface CouponRepository extends JpaRepository<Coupon, Long> {
    @Modifying
    @Query("""
        UPDATE Coupon c SET c.uses = c.uses + 1
        WHERE c.code = :code AND c.uses < c.maxUses
        """)
    int incrementIfAvailable(@Param("code") String code);
}

@Service
public class CouponService {
    @Transactional
    public RedemptionResult redeem(String code, String customerId, String idempotencyKey) {
        if (redemptions.existsByIdempotencyKey(idempotencyKey)) {
            return RedemptionResult.alreadyProcessed();                 // retry of the same request
        }
        if (repository.incrementIfAvailable(code) == 0) {
            return RedemptionResult.exhausted();
        }
        redemptions.save(new Redemption(code, customerId, idempotencyKey));   // unique constraint on idempotency_key
        return RedemptionResult.redeemed();
    }
}
```
### 2. Concurrency regression test
```java
@Test
void neverRedeemsMoreThanMaxUses() throws Exception {
    couponFixtures.create("AUTUMN10", 5);
    try (var pool = Executors.newFixedThreadPool(32)) {
        var tasks = IntStream.range(0, 200)
            .mapToObj(i -> (Callable<RedemptionResult>) () -> service.redeem("AUTUMN10", "c-" + i, "key-" + i))
            .toList();
        var results = pool.invokeAll(tasks);
        long redeemed = results.stream().filter(f -> f.resultNow().isRedeemed()).count();
        assertThat(redeemed).isEqualTo(5);
    }
    assertThat(couponRepository.findByCode("AUTUMN10").getUses()).isEqualTo(5);
}
```
**Why it's right:**
- The invariant is enforced atomically by the database, so it holds across any number of instances; retries are idempotent.
- A stress test runs 200 concurrent redemptions against a real database and asserts the invariant.
