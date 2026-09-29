# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Happy path only, shared state, sleeps
```rust
static mut COUNTER: u32 = 0;                                    // shared mutable global across parallel tests

#[test]
fn test_parse() {
    assert!(parse_amount("10.50").is_ok());                      // no check of the value or of error cases
}

#[tokio::test]
async fn test_retry() {
    tokio::spawn(start_worker());
    std::thread::sleep(std::time::Duration::from_secs(5));       // blocks the runtime and slows the suite
    unsafe { assert_eq!(COUNTER, 3) };
}
```
**Why it's wrong:**
- Assertions are vague and error paths are untested; global mutable state makes parallel tests flaky.
- Real sleeps make tests slow and nondeterministic.

## Best Practice (How to do it right)

### 1. Table-driven cases with rstest and error variants
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case::whole("10", 1000)]
    #[case::cents("10.50", 1050)]
    #[case::zero("0.00", 0)]
    fn parses_valid_amounts(#[case] input: &str, #[case] expected_cents: i64) {
        assert_eq!(parse_amount(input).unwrap().cents(), expected_cents);
    }

    #[rstest]
    #[case::empty("")]
    #[case::three_decimals("1.005")]
    #[case::negative("-1")]
    fn rejects_invalid_amounts(#[case] input: &str) {
        assert!(matches!(parse_amount(input), Err(AmountError::Invalid { .. })), "input {input:?}");
    }
}
```
### 2. Property test and snapshot test
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn amount_round_trips(cents in 0i64..10_000_000) {
        let amount = Amount::from_cents(cents);
        prop_assert_eq!(parse_amount(&amount.to_string()).unwrap(), amount);
    }
}

#[test]
fn invoice_renders_as_expected() {
    let invoice = sample_invoice();
    insta::assert_snapshot!(render_invoice_text(&invoice));      // reviewed with `cargo insta review`
}
```
### 3. Database integration test with sqlx::test
```rust
#[sqlx::test(migrations = "./migrations")]
async fn cancelling_a_shipped_order_fails(pool: PgPool) {
    let id = seed_order(&pool, OrderStatus::Shipped).await;
    let err = cancel(&pool, &id).await.unwrap_err();
    assert!(matches!(err, OrderError::NotCancellable { .. }));
}
```
**Why it's right:**
- Cases are explicit and named, error variants are asserted, and properties cover the input space with shrinking.
- Snapshots capture complex output for review, and integration tests run against a real, migrated database per test.
