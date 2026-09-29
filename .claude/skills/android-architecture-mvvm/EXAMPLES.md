# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. ViewModel with Context, mutable public state, and network types
```kotlin
class OrdersViewModel(private val context: Context) : ViewModel() {       // leaks the Activity
    val orders = MutableLiveData<List<OrderDto>>()                          // mutable, network DTOs in UI
    var isLoading = false
    var error: String? = null                                               // several independent fields

    fun load() {
        GlobalScope.launch {                                                // outlives the ViewModel
            isLoading = true
            orders.postValue(Retrofit.Builder().baseUrl("https://api.example.com").build()
                .create(OrdersApi::class.java).getOrders())
            isLoading = false
            Toast.makeText(context, "Loaded", Toast.LENGTH_SHORT).show()
        }
    }
}
```
**Why it's wrong:**
- Holding a `Context` leaks the Activity; UI state is mutable from outside and split into contradictory fields.
- Networking is created inline without DI or caching, `GlobalScope` ignores the ViewModel lifecycle, and errors crash the coroutine.

## Best Practice (How to do it right)

### 1. Offline-first repository and a UDF ViewModel with Hilt
```kotlin
class OfflineFirstOrdersRepository @Inject constructor(
    private val dao: OrderDao,
    private val api: OrdersApi,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
) : OrdersRepository {
    override fun observeOrders(): Flow<List<Order>> =
        dao.observeAll().map { entities -> entities.map(OrderEntity::toDomain) }

    override suspend fun refresh(): Result<Unit> = withContext(ioDispatcher) {
        runCatching { dao.upsertAll(api.getOrders().map(OrderDto::toEntity)) }
    }
}

data class OrdersUiState(
    val query: String = "",
    val orders: List<OrderItemUi> = emptyList(),
    val isRefreshing: Boolean = false,
    @StringRes val errorMessage: Int? = null,
)

@HiltViewModel
class OrdersViewModel @Inject constructor(
    private val repository: OrdersRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val query = savedStateHandle.getStateFlow("query", "")
    private val refreshState = MutableStateFlow(RefreshState())

    val uiState: StateFlow<OrdersUiState> =
        combine(repository.observeOrders(), query, refreshState) { orders, q, refresh ->
            OrdersUiState(
                query = q,
                orders = orders.filter { it.number.contains(q, ignoreCase = true) }.map(Order::toUi),
                isRefreshing = refresh.inProgress,
                errorMessage = refresh.errorMessage,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), OrdersUiState())

    init { refresh() }

    fun onQueryChange(value: String) { savedStateHandle["query"] = value }

    fun refresh() {
        viewModelScope.launch {
            refreshState.value = RefreshState(inProgress = true)
            val result = repository.refresh()
            refreshState.value = RefreshState(errorMessage = if (result.isFailure) R.string.orders_refresh_error else null)
        }
    }
}

private data class RefreshState(val inProgress: Boolean = false, @StringRes val errorMessage: Int? = null)
```
**Why it's right:**
- The database is the single source of truth, refreshed from the network in the background; DTOs never reach the UI.
- The ViewModel exposes one immutable `StateFlow`, survives process death for the query, and has no Android UI dependencies.
- Dependencies, including the dispatcher, are injected by Hilt and replaceable in tests.
