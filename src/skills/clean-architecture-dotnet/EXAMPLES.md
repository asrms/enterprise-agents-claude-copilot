# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Anemic entity and service manipulating state
```csharp
public class Order                                  // in the "Models" folder of the API project
{
    [Key] public int Id { get; set; }
    public string Status { get; set; } = "";
    public decimal Total { get; set; }
    public List<OrderLine> Lines { get; set; } = new();
}

public class OrderService(AppDbContext db)
{
    public async Task PayAsync(int id)
    {
        var order = await db.Orders.FindAsync(id);
        order!.Status = "Paid";                     // any code can set any status, invariants nowhere
        await db.SaveChangesAsync();
    }
}
```
**Why it's wrong:**
- Business rules (only pending orders can be paid, totals must match lines) are not enforced anywhere.
- The model depends on EF Core attributes and lives in the API project; everything depends on `DbContext`.

## Best Practice (How to do it right)

### 1. Rich aggregate, port, and handler
```csharp
// Domain
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];
    public OrderId Id { get; }
    public CustomerId CustomerId { get; }
    public OrderStatus Status { get; private set; } = OrderStatus.Pending;
    public IReadOnlyList<OrderLine> Lines => _lines;
    public Money Total => Money.Sum(_lines.Select(l => l.Subtotal));

    private Order(OrderId id, CustomerId customerId) { Id = id; CustomerId = customerId; }

    public static Order Place(CustomerId customerId, IEnumerable<OrderLine> lines)
    {
        var order = new Order(OrderId.New(), customerId);
        order._lines.AddRange(lines);
        if (order._lines.Count == 0) throw new DomainException("An order needs at least one line.");
        return order;
    }

    public void Pay(Money amount)
    {
        if (Status != OrderStatus.Pending) throw new DomainException($"Cannot pay an order in status {Status}.");
        if (amount != Total) throw new DomainException("Payment amount does not match the order total.");
        Status = OrderStatus.Paid;
    }
}

public readonly record struct Money(decimal Amount, string Currency) { /* validation and Sum */ }

// Application
public interface IOrderRepository
{
    Task<Order?> GetAsync(OrderId id, CancellationToken ct);
    Task SaveAsync(Order order, CancellationToken ct);
}

public sealed class PayOrderHandler(IOrderRepository orders)
{
    public async Task HandleAsync(PayOrder cmd, CancellationToken ct)
    {
        var order = await orders.GetAsync(cmd.OrderId, ct) ?? throw new NotFoundException(cmd.OrderId);
        order.Pay(cmd.Amount);
        await orders.SaveAsync(order, ct);
    }
}
```
```csharp
// Tests/ArchitectureTests.cs
[Fact]
public void Domain_does_not_depend_on_infrastructure()
{
    var result = Types.InAssembly(typeof(Order).Assembly)
        .ShouldNot().HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "Acme.Shop.Infrastructure")
        .GetResult();
    Assert.True(result.IsSuccessful);
}
```
**Why it's right:**
- Invariants live in the aggregate and cannot be bypassed; the domain has no framework dependencies.
- The handler depends on a port owned by the Application layer, so it is testable with a fake.
- An architecture test keeps the dependency rule from eroding over time.
