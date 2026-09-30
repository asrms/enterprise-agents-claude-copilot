# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Real dispatchers, sleeps, and over-mocking
```kotlin
class OrdersViewModelTest {
    @Test
    fun loadsOrders() {
        val repo = mockk<OrdersRepository>(relaxed = true)          // returns defaults for everything
        val vm = OrdersViewModel(repo, SavedStateHandle())          // launches on the real Main dispatcher
        Thread.sleep(1000)                                          // waits for the coroutine
        verify { repo.observeOrders() }                             // checks a call, not the resulting state
    }
}
```
**Why it's wrong:**
- `Dispatchers.Main` is not available in local tests, and sleeping makes the test slow and flaky.
- A relaxed mock hides missing behavior; the test asserts an interaction instead of the UI state users depend on.

## Best Practice (How to do it right)

### 1. ViewModel test with a fake, test dispatcher, and Turbine
```kotlin
class MainDispatcherRule(val dispatcher: TestDispatcher = UnconfinedTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}

class OrdersViewModelTest {
    @get:Rule val mainRule = MainDispatcherRule()
    private val repository = FakeOrdersRepository()

    @Test
    fun `filters orders by query`() = runTest {
        repository.emit(listOf(order("SO-1001"), order("SO-2002")))
        val vm = OrdersViewModel(repository, SavedStateHandle())

        vm.uiState.test {
            assertEquals(listOf("SO-1001", "SO-2002"), awaitItem().orders.map { it.number })
            vm.onQueryChange("2002")
            assertEquals(listOf("SO-2002"), awaitItem().orders.map { it.number })
        }
    }

    @Test
    fun `shows an error when refresh fails`() = runTest {
        repository.failNextRefresh = true
        val vm = OrdersViewModel(repository, SavedStateHandle())
        vm.uiState.test {
            assertEquals(R.string.orders_refresh_error, expectMostRecentItem().errorMessage)
        }
    }
}
```
### 2. Compose UI test of a stateless screen
```kotlin
class OrdersScreenTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun clickingDeleteReportsTheOrder() {
        var deleted: OrderId? = null
        composeRule.setContent {
            AppTheme {
                OrdersScreen(
                    uiState = OrdersUiState(orders = listOf(orderUi("o-1", "SO-1001"))),
                    onQueryChange = {}, onOrderClick = {}, onDeleteClick = { deleted = it },
                )
            }
        }

        composeRule.onNodeWithText("SO-1001").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Delete order SO-1001").performClick()
        assertEquals(OrderId("o-1"), deleted)
    }
}
```
**Why it's right:**
- The ViewModel runs on a test dispatcher with a deterministic fake, and assertions target the exposed UI state.
- The UI test drives the screen through semantics, which also verifies accessible labels.
