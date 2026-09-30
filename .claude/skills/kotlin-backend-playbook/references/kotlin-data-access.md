# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Blocking JDBC on the default dispatcher with string SQL
```kotlin
suspend fun search(term: String, sort: String): List<Map<String, Any>> = withContext(Dispatchers.Default) {
    dataSource.connection.use { c ->
        c.createStatement().executeQuery(
            "SELECT * FROM product WHERE name LIKE '%$term%' ORDER BY $sort"      // SQL injection twice
        ).toMaps()
    }
}
```
**Why it's wrong:**
- Blocking I/O runs on the CPU-bound dispatcher and can starve it; SQL is built from user input.
- Results are untyped maps, and `SELECT *` fetches everything.

## Best Practice (How to do it right)

### 1. jOOQ with a bounded IO dispatcher and allow-listed sorting
```kotlin
class JooqProductRepository(private val dsl: DSLContext, poolSize: Int) : ProductRepository {
    private val db = Dispatchers.IO.limitedParallelism(poolSize)          // matches the HikariCP pool
    private val sortable = mapOf("name" to PRODUCT.NAME, "price" to PRODUCT.PRICE)

    override suspend fun search(term: String, sort: String, after: ProductCursor?, limit: Int): List<ProductSummary> =
        withContext(db) {
            val sortField = sortable[sort] ?: PRODUCT.NAME
            dsl.select(PRODUCT.ID, PRODUCT.NAME, PRODUCT.PRICE)
                .from(PRODUCT)
                .where(PRODUCT.NAME.containsIgnoreCase(term))
                .orderBy(sortField, PRODUCT.ID)
                .let { q -> after?.let { q.seekAfter(it.sortValue, it.id) } ?: q }   // jOOQ keyset pagination from the last row
                .limit(limit)
                .fetch { r -> ProductSummary(ProductId(r[PRODUCT.ID]), r[PRODUCT.NAME], Money(r[PRODUCT.PRICE])) }
        }
}
```
### 2. Exposed with a suspended transaction and optimistic locking
```kotlin
suspend fun reserve(productId: ProductId, quantity: Int, expectedVersion: Long): ReservationResult =
    newSuspendedTransaction(Dispatchers.IO, database) {
        val updated = Stock.update({ (Stock.productId eq productId.value) and (Stock.version eq expectedVersion) and (Stock.available greaterEq quantity) }) {
            with(SqlExpressionBuilder) {
                it[available] = available - quantity
                it[version] = version + 1
            }
        }
        if (updated == 1) ReservationResult.Reserved else ReservationResult.Conflict
    }
```
**Why it's right:**
- Queries are type-safe and parameterized, sorting is allow-listed, pagination is keyset-based, and rows map to immutable domain types.
- Blocking work runs on a bounded dispatcher, and concurrent updates are protected by a conditional, versioned update.
