# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Logic in composition, lifecycle-unaware collection, unkeyed list
```kotlin
@Composable
fun OrdersScreen(repository: OrdersRepository) {
    val orders by repository.observeOrders().collectAsState(initial = emptyList())  // new flow on every recomposition
    var filter = ""                                                                   // state lost on recomposition
    repository.trackScreenView("orders")                                              // side effect in composition

    Column(Modifier.verticalScroll(rememberScrollState())) {
        LazyColumn {                                                                  // nested scrolling in the same direction
            items(orders.filter { it.number.contains(filter) }) { order ->           // no key, filtering every recomposition
                Row(Modifier.clickable { /* navigate */ }) {
                    Icon(Icons.Default.Delete, contentDescription = null)             // unlabeled action icon
                    Text(order.number, color = Color(0xFF888888), fontSize = 12.sp)
                }
            }
        }
    }
}
```
**Why it's wrong:**
- The repository is called from UI, the flow is recreated and collected without lifecycle awareness, and a side effect runs on every recomposition.
- The lazy list is nested in a scrolling column (crash), items have no keys, and the delete icon has no accessible name.

## Best Practice (How to do it right)

### 1. Stateful route, stateless screen, keyed lazy list
```kotlin
@Composable
fun OrdersRoute(
    onOrderClick: (OrderId) -> Unit,
    viewModel: OrdersViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    OrdersScreen(
        uiState = uiState,
        onQueryChange = viewModel::onQueryChange,
        onOrderClick = onOrderClick,
        onDeleteClick = viewModel::onDeleteClick,
    )
}

@Composable
fun OrdersScreen(
    uiState: OrdersUiState,
    onQueryChange: (String) -> Unit,
    onOrderClick: (OrderId) -> Unit,
    onDeleteClick: (OrderId) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize()) {
        SearchField(query = uiState.query, onQueryChange = onQueryChange)
        when (uiState.content) {
            is OrdersContent.Loading -> LoadingIndicator()
            is OrdersContent.Error -> ErrorMessage(stringResource(R.string.orders_load_error))
            is OrdersContent.Loaded -> LazyColumn {
                items(uiState.content.orders, key = { it.id.value }, contentType = { "order" }) { order ->
                    OrderRow(order = order, onClick = { onOrderClick(order.id) }, onDelete = { onDeleteClick(order.id) })
                }
            }
        }
    }
}

@Composable
private fun OrderRow(order: OrderItemUi, onClick: () -> Unit, onDelete: () -> Unit, modifier: Modifier = Modifier) {
    ListItem(
        modifier = modifier.clickable(onClick = onClick),
        headlineContent = { Text(order.number, style = MaterialTheme.typography.titleMedium) },
        supportingContent = { Text(order.formattedTotal) },
        trailingContent = {
            IconButton(onClick = onDelete) {
                Icon(Icons.Outlined.Delete, contentDescription = stringResource(R.string.delete_order, order.number))
            }
        },
    )
}

@PreviewLightDark
@PreviewFontScale
@Composable
private fun OrdersScreenPreview() = AppTheme {
    OrdersScreen(OrdersUiState.sample(), onQueryChange = {}, onOrderClick = {}, onDeleteClick = {})
}
```
**Why it's right:**
- The route collects lifecycle-aware state from the ViewModel; the screen is stateless, previewable, and testable.
- The list is keyed, filtering happens in the ViewModel, and colors and text come from the theme and resources.
- Actions have accessible names and 48dp targets through `IconButton`.
