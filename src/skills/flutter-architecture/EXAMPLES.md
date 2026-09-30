# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Networking and state in a StatefulWidget
```dart
class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});
  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  List<dynamic> orders = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    http.get(Uri.parse('https://api.example.com/orders')).then((res) {
      setState(() {
        orders = jsonDecode(res.body);            // dynamic JSON in the UI, no error handling
        loading = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) => loading
      ? const CircularProgressIndicator()
      : ListView(children: orders.map((o) => Text(o['number'])).toList());
}
```
**Why it's wrong:**
- The widget performs networking and parsing, uses `dynamic` data, and ignores failures; `setState` may run after dispose.
- Nothing can be tested without the network, and the logic cannot be reused.

## Best Practice (How to do it right)

### 1. Sealed state, repository, and a view model (Riverpod)
```dart
sealed class OrdersState {
  const OrdersState();
}
final class OrdersLoading extends OrdersState { const OrdersLoading(); }
final class OrdersLoaded extends OrdersState {
  const OrdersLoaded(this.orders);
  final List<Order> orders;
}
final class OrdersFailed extends OrdersState {
  const OrdersFailed(this.message);
  final String message;
}

abstract interface class OrdersRepository {
  Future<List<Order>> fetchOrders();
}

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) => HttpOrdersRepository(ref.watch(dioProvider)));

final ordersViewModelProvider = NotifierProvider<OrdersViewModel, OrdersState>(OrdersViewModel.new);

class OrdersViewModel extends Notifier<OrdersState> {
  @override
  OrdersState build() {
    Future.microtask(load);
    return const OrdersLoading();
  }

  Future<void> load() async {
    state = const OrdersLoading();
    try {
      state = OrdersLoaded(await ref.read(ordersRepositoryProvider).fetchOrders());
    } on OrdersException catch (e) {
      state = OrdersFailed(e.userMessage);
    }
  }
}

class OrdersPage extends ConsumerWidget {
  const OrdersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(ordersViewModelProvider);
    return switch (state) {
      OrdersLoading() => const Center(child: CircularProgressIndicator()),
      OrdersFailed(:final message) => ErrorView(message: message, onRetry: ref.read(ordersViewModelProvider.notifier).load),
      OrdersLoaded(:final orders) => ListView.builder(
          itemCount: orders.length,
          itemBuilder: (context, i) => OrderTile(key: ValueKey(orders[i].id), order: orders[i]),
        ),
    };
  }
}
```
**Why it's right:**
- The widget renders an exhaustive sealed state; logic lives in a notifier that depends on an injectable repository interface.
- Failures map to a user-facing state, lists are built lazily with stable keys, and everything can be tested with a fake repository.
