# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Networking in the view, contradictory flags, singleton access
```swift
struct OrdersView: View {
    @State private var orders: [Order] = []
    @State private var isLoading = false
    @State private var hasError = false          // can be true together with isLoading

    var body: some View {
        List(orders) { order in Text(order.number) }
            .onAppear {
                isLoading = true
                URLSession.shared.dataTask(with: URL(string: "https://api.example.com/orders")!) { data, _, _ in
                    orders = try! JSONDecoder().decode([Order].self, from: data!)   // crashes on bad data, off main thread
                    isLoading = false
                }.resume()
            }
    }
}
```
**Why it's wrong:**
- The view performs networking and decoding, mutates state from a background thread, and force-unwraps external data.
- Independent booleans allow impossible states; nothing can be tested or previewed without the network.

## Best Practice (How to do it right)

### 1. Observable model, explicit state, injected service, typed navigation
```swift
protocol OrdersService: Sendable {
    func fetchOrders() async throws -> [Order]
}

@MainActor
@Observable
final class OrdersModel {
    enum State { case idle, loading, loaded([Order]), failed(String) }

    private(set) var state: State = .idle
    private let service: any OrdersService

    init(service: any OrdersService) { self.service = service }

    func load() async {
        state = .loading
        do {
            let orders = try await service.fetchOrders()
            state = .loaded(orders)
        } catch {
            state = .failed("Orders could not be loaded.")
        }
    }
}

enum Route: Hashable { case orderDetail(Order.ID) }

struct OrdersView: View {
    @State private var model: OrdersModel
    @State private var path: [Route] = []

    init(service: any OrdersService) { _model = State(initialValue: OrdersModel(service: service)) }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .navigationTitle("Orders")
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .orderDetail(let id): OrderDetailView(orderID: id)
                    }
                }
        }
        .task { await model.load() }
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .idle, .loading: ProgressView()
        case .failed(let message):
            ContentUnavailableView(message, systemImage: "exclamationmark.triangle")
        case .loaded(let orders):
            List(orders) { order in
                NavigationLink(value: Route.orderDetail(order.id)) { OrderRow(order: order) }
            }
        }
    }
}

#Preview("Loaded") { OrdersView(service: PreviewOrdersService(orders: .samples)) }
#Preview("Error") { OrdersView(service: PreviewOrdersService(error: URLError(.notConnectedToInternet))) }
```
**Why it's right:**
- The model is main-actor isolated, holds a single explicit state, and depends on a protocol that tests and previews can replace.
- `.task` ties loading to the view lifecycle with automatic cancellation; navigation uses typed routes.
- Previews document every state without a network.
