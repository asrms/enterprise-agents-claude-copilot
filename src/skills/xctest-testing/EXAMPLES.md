# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Live network, sleeps, fragile UI queries
```swift
final class OrdersTests: XCTestCase {
    func testLoad() {
        let model = OrdersModel(service: LiveOrdersService())   // real backend
        Task { await model.load() }
        sleep(3)                                                // hope it finished
        XCTAssertTrue(model.orders.count > 0)
    }

    func testOpenOrder() {
        let app = XCUIApplication()
        app.launch()
        app.cells.element(boundBy: 0).tap()                     // index-based, data-dependent
        XCTAssertTrue(app.staticTexts["Order details"].exists) // localized text, no waiting
    }
}
```
**Why it's wrong:**
- Results depend on the network and timing; the assertion is vague.
- The UI test depends on live data order and localized strings and does not wait for elements.

## Best Practice (How to do it right)

### 1. Swift Testing with fakes and parameterized cases
```swift
import Testing
@testable import OrdersFeature

struct FakeOrdersService: OrdersService {
    var result: Result<[Order], Error>
    func fetchOrders() async throws -> [Order] { try result.get() }
}

@MainActor
@Suite("Orders model")
struct OrdersModelTests {
    @Test("Loading publishes the fetched orders")
    func loadSuccess() async throws {
        let model = OrdersModel(service: FakeOrdersService(result: .success([.sample(number: "SO-1001")])))
        await model.load()
        guard case .loaded(let orders) = model.state else {
            Issue.record("Expected loaded state, got \(model.state)")
            return
        }
        #expect(orders.map(\.number) == ["SO-1001"])
    }

    @Test("Loading failures map to an error state", arguments: [
        URLError(.notConnectedToInternet), URLError(.timedOut),
    ])
    func loadFailure(error: URLError) async {
        let model = OrdersModel(service: FakeOrdersService(result: .failure(error)))
        await model.load()
        guard case .failed = model.state else {
            Issue.record("Expected failed state")
            return
        }
    }
}
```
### 2. UI test with launch arguments and identifiers
```swift
final class OrdersUITests: XCTestCase {
    func testOpeningAnOrderShowsItsDetails() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-stubData", "orders-basic"]
        app.launch()

        let row = app.buttons["orders.row.SO-1001"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()

        XCTAssertTrue(app.otherElements["orderDetail.screen"].waitForExistence(timeout: 5))
    }
}
```
**Why it's right:**
- Unit tests are deterministic, parallel-safe, and parameterized; they assert explicit state.
- The UI test selects stubbed data at launch and finds elements by stable identifiers, waiting for them to appear.
