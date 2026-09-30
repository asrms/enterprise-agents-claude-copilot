# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Real backend and sleeps in a widget test (Flutter)
```dart
testWidgets('shows orders', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: OrdersPage()));   // uses the real HTTP repository
  await Future.delayed(const Duration(seconds: 3));                 // real delay, not pumped
  expect(find.byType(ListTile), findsWidgets);                      // vague assertion
});
```
**Why it's wrong:**
- The test depends on the network and timing, and asserts nothing specific about what the user sees.

## Best Practice (How to do it right)

### 1. Flutter widget test with provider overrides
```dart
class FakeOrdersRepository implements OrdersRepository {
  FakeOrdersRepository(this.result);
  final Future<List<Order>> Function() result;
  @override
  Future<List<Order>> fetchOrders() => result();
}

void main() {
  testWidgets('renders orders from the repository', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ordersRepositoryProvider.overrideWithValue(
          FakeOrdersRepository(() async => [Order(id: 'o-1', number: 'SO-1001')]),
        ),
      ],
      child: const MaterialApp(home: OrdersPage()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('SO-1001'), findsOneWidget);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  });

  testWidgets('shows a retry action on failure', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [ordersRepositoryProvider.overrideWithValue(FakeOrdersRepository(() async => throw const OrdersException('offline')))],
      child: const MaterialApp(home: OrdersPage()),
    ));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
  });
}
```
### 2. React Native component test and a Maestro flow
```tsx
it('adds an item to the cart', async () => {
  render(<ProductScreen productId="p-1" />, { wrapper: createTestProviders() })
  await userEvent.press(await screen.findByRole('button', { name: 'Add to cart' }))
  expect(screen.getByText('1 item in cart')).toBeOnTheScreen()
})
```
`e2e/checkout.yaml`:
```yaml
appId: com.example.shop
---
- launchApp:
    clearState: true
    arguments: { useMockBackend: "true" }
- tapOn: "Trail Shoe"
- tapOn: "Add to cart"
- tapOn: "Checkout"
- assertVisible: "Order confirmed"
```
**Why it's right:**
- Dependencies are overridden with fakes, async work is pumped deterministically, and assertions check visible text and accessibility guidelines.
- The end-to-end flow starts from a clean state against a mock backend and reads like the user journey.
