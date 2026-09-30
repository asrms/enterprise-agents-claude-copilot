# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Java-style Kotlin with nulls and mutable state
```kotlin
object OrderCache { var orders = HashMap<String, Order>() }          // global mutable state

class OrderService(private val repo: OrderRepository) {
    lateinit var clock: Clock

    fun cancel(id: String?): String {
        val order = repo.find(id!!)!!                                  // crashes on missing input or order
        if (order.status == "SHIPPED") return "ERROR"                  // stringly typed status and result
        order.status = "CANCELLED"                                     // mutable entity
        OrderCache.orders[id] = order
        return "OK"
    }
}
```
**Why it's wrong:**
- `!!` turns missing data into crashes, strings stand in for types, and shared mutable state is not thread-safe.
- Results are ambiguous strings, so callers cannot handle outcomes exhaustively.

## Best Practice (How to do it right)

### 1. Value classes, sealed results, immutable data
```kotlin
@JvmInline
value class OrderId(val value: String) {
    init { require(value.matches(Regex("^SO-[0-9]{4,10}$"))) { "Invalid order id: $value" } }
}

enum class OrderStatus { PENDING, PAID, SHIPPED, CANCELLED }

data class Order(val id: OrderId, val status: OrderStatus, val total: Money) {
    fun cancel(): Order = copy(status = OrderStatus.CANCELLED)
}

sealed interface CancelResult {
    data class Cancelled(val order: Order) : CancelResult
    data object NotFound : CancelResult
    data class NotCancellable(val status: OrderStatus) : CancelResult
}

class CancelOrder(private val orders: OrderRepository) {
    fun execute(id: OrderId): CancelResult {
        val order = orders.find(id) ?: return CancelResult.NotFound
        return when (order.status) {
            OrderStatus.PENDING, OrderStatus.PAID -> CancelResult.Cancelled(orders.save(order.cancel()))
            OrderStatus.SHIPPED, OrderStatus.CANCELLED -> CancelResult.NotCancellable(order.status)
        }
    }
}

// caller: exhaustive handling without else
fun CancelResult.toHttpStatus(): Int = when (this) {
    is CancelResult.Cancelled -> 200
    CancelResult.NotFound -> 404
    is CancelResult.NotCancellable -> 409
}
```
**Why it's right:**
- Identifiers validate themselves, data is immutable, and outcomes are a sealed type handled exhaustively.
- Missing orders are handled with `?:` instead of crashing, and there is no shared mutable state.
