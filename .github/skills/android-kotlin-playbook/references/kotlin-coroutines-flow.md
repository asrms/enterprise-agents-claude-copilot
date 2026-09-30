# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. GlobalScope, swallowed cancellation, blocking calls
```kotlin
class PriceSync(private val api: PriceApi, private val dao: PriceDao) {
    fun syncAll(skus: List<String>) {
        GlobalScope.launch(Dispatchers.Main) {                   // unscoped, on the main thread
            for (sku in skus) {
                try {
                    val price = api.getPrice(sku)                // sequential, unbounded total time
                    dao.insertBlocking(price)                    // blocking I/O on Main
                } catch (e: Exception) {                         // also catches CancellationException
                    Log.e("sync", "failed", e)
                }
            }
        }
    }
}
```
**Why it's wrong:**
- The coroutine outlives its owner and cannot be cancelled or tested; blocking I/O runs on the main thread.
- Catching all exceptions swallows cancellation, so the loop keeps running after the scope is cancelled.

## Best Practice (How to do it right)

### 1. Main-safe, bounded, cancellable suspend function
```kotlin
class PriceSync(
    private val api: PriceApi,
    private val dao: PriceDao,
    @IoDispatcher private val io: CoroutineDispatcher,
) {
    suspend fun syncAll(skus: List<String>): SyncReport = withContext(io) {
        val limit = Semaphore(permits = 8)
        val results = coroutineScope {
            skus.map { sku ->
                async {
                    limit.withPermit {
                        try {
                            val price = withTimeout(3.seconds) { api.getPrice(sku) }
                            dao.upsert(price)
                            sku to true
                        } catch (e: CancellationException) {
                            throw e                                  // never swallow cancellation
                        } catch (e: IOException) {
                            sku to false
                        }
                    }
                }
            }.awaitAll()
        }
        SyncReport(succeeded = results.count { it.second }, failed = results.filterNot { it.second }.map { it.first })
    }
}
```
### 2. Latest-wins search as StateFlow, and a Turbine test
```kotlin
class SearchViewModel(private val repo: ProductRepository) : ViewModel() {
    private val query = MutableStateFlow("")

    val results: StateFlow<List<Product>> = query
        .debounce(300)
        .map(String::trim)
        .distinctUntilChanged()
        .flatMapLatest { q -> if (q.length < 2) flowOf(emptyList()) else repo.search(q) }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun onQueryChange(value: String) { query.value = value }
}

@Test
fun `emits results for the latest query only`() = runTest {
    Dispatchers.setMain(StandardTestDispatcher(testScheduler))
    val vm = SearchViewModel(FakeProductRepository(mapOf("shoe" to listOf(product("Trail shoe")))))
    vm.results.test {
        assertEquals(emptyList(), awaitItem())
        vm.onQueryChange("sh")
        vm.onQueryChange("shoe")
        advanceTimeBy(301)
        assertEquals(listOf("Trail shoe"), awaitItem().map { it.name })
        cancelAndIgnoreRemainingEvents()
    }
    Dispatchers.resetMain()
}
```
**Why it's right:**
- Work is structured, main-safe, time-bounded, and concurrency-limited; cancellation propagates correctly.
- The search flow debounces, cancels outdated queries, handles errors, and shares state only while observed.
- Virtual time makes the test fast and deterministic.
