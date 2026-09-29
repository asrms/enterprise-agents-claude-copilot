# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tests coupled to implementation with weak assertions (Java)
```java
@Test
void test1() {
    OrderService service = spy(new OrderService(repo, clock));
    when(repo.findById(1L)).thenReturn(Optional.of(order));

    service.cancel(1L);

    verify(service).validateCancellable(order);        // private detail made package-visible for the test
    verify(repo).findById(1L);                          // verifying a stubbed query
    verify(repo, atLeastOnce()).save(any());            // what was saved?
    assertNotNull(order);                               // cannot fail
}
```
**Why it's wrong:**
- It spies on the class under test and verifies an internal method: any refactoring breaks the test without any behavior change.
- `verify(repo).findById` duplicates the stub; `save(any())` does not check the cancelled state.
- The name and the final assertion say nothing about the expected behavior.

### 2. Non-deterministic test with sleep and logic (TypeScript)
```typescript
it('expires sessions', async () => {
  const session = createSession({ ttlMinutes: 1 });
  await new Promise((r) => setTimeout(r, 61_000));        // one real minute
  for (const s of store.all()) {
    if (s.id === session.id) {
      expect(isExpired(s, new Date())).toBe(Date.now() - s.createdAt > 60_000);  // re-implements the rule
    }
  }
});
```
**Why it's wrong:**
- The test waits a real minute and depends on the machine clock.
- The expected value is computed with the same rule as the code under test, so a wrong rule passes.
- If the session is not in the store, the loop runs zero assertions and the test passes.

### 3. Happy path only, with an in-memory substitute database (Python)
```python
def test_create_user(sqlite_session):          # production uses PostgreSQL
    user = create_user(sqlite_session, email="a@b.c")
    assert user
```
**Why it's wrong:**
- SQLite ignores constraints and types that PostgreSQL enforces (e.g. case-insensitive unique index on email, `citext`, JSONB).
- Duplicates, invalid emails, and database errors are never tested; `assert user` cannot fail meaningfully.

## Best Practice (How to do it right)

### 1. Tests coupled to implementation with weak assertions (Java)
```java
@Test
void shouldCancelOrderAndReleaseStock_whenOrderIsNotShipped() {
    // given
    Order order = anOrder().withId(ORDER_ID).withStatus(CONFIRMED).withLine("SKU-1", 2).build();
    given(orders.findById(ORDER_ID)).willReturn(Optional.of(order));

    // when
    sut.cancel(ORDER_ID);

    // then
    then(orders).should().save(orderCaptor.capture());
    assertThat(orderCaptor.getValue().status()).isEqualTo(CANCELLED);
    then(stock).should().release("SKU-1", 2);
}

@Test
void shouldRejectCancellation_whenOrderIsAlreadyShipped() {
    given(orders.findById(ORDER_ID)).willReturn(Optional.of(anOrder().withStatus(SHIPPED).build()));

    assertThatThrownBy(() -> sut.cancel(ORDER_ID))
        .isInstanceOf(IllegalOrderTransitionException.class)
        .hasMessageContaining("SHIPPED");
    then(orders).should(never()).save(any());
}
```
**Why it's right:**
- Tests assert observable outcomes (saved state, released stock, exception) through the public API.
- Each test covers one behavior and its name documents the rule; the error path has its own test.
- Builders keep irrelevant setup out of sight so the meaningful values stand out.

### 2. Non-deterministic test with sleep and logic (TypeScript)
```typescript
describe('isExpired', () => {
  const createdAt = new Date('2025-01-01T10:00:00Z');

  it.each([
    { now: '2025-01-01T10:00:59Z', expected: false },
    { now: '2025-01-01T10:01:00Z', expected: true },   // boundary: exactly the TTL
    { now: '2025-01-01T12:00:00Z', expected: true },
  ])('returns $expected at $now for a 1-minute TTL', ({ now, expected }) => {
    const session = { id: 's1', createdAt, ttlMinutes: 1 };
    expect(isExpired(session, new Date(now))).toBe(expected);
  });
});
```
**Why it's right:**
- Time is a parameter: the test is instant and deterministic.
- Expected values are literals in a table, including the boundary case, instead of a re-implementation of the rule.

### 3. Happy path only, with an in-memory substitute database (Python)
```python
@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as pg:
        run_migrations(pg.get_connection_url())
        yield pg


def test_create_user_persists_normalized_email(session):
    user = create_user(session, email="Ada@Example.com")
    assert session.get(User, user.id).email == "ada@example.com"


def test_create_user_rejects_duplicate_email_case_insensitively(session):
    create_user(session, email="ada@example.com")
    with pytest.raises(EmailAlreadyRegistered):
        create_user(session, email="ADA@example.com")


@pytest.mark.parametrize("email", ["", "no-at-sign", "a@", "x" * 255 + "@example.com"])
def test_create_user_rejects_invalid_email(session, email):
    with pytest.raises(ValidationError):
        create_user(session, email=email)
```
**Why it's right:**
- Tests run against the same database engine and migrations as production.
- Duplicates, normalization, and invalid inputs are covered explicitly with precise assertions.
