# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tracking, over-fetching, N+1, and row-by-row updates
```csharp
public async Task<List<OrderSummary>> GetSummaries(Guid customerId)
{
    var orders = db.Orders.ToList()                                  // loads the whole table, synchronously
        .Where(o => o.CustomerId == customerId);                     // filtered in memory

    var result = new List<OrderSummary>();
    foreach (var o in orders)
        result.Add(new OrderSummary(o.Id, o.Lines.Sum(l => l.Price), o.Customer.Name)); // lazy loads per order
    return result;
}

public async Task ExpireOldCarts()
{
    var carts = await db.Carts.Where(c => c.UpdatedAt < DateTime.UtcNow.AddDays(-30)).ToListAsync();
    foreach (var c in carts) c.Status = CartStatus.Expired;          // loads and tracks thousands of entities
    await db.SaveChangesAsync();
}
```
**Why it's wrong:**
- The full table is loaded and filtered client-side; lazy loading fires two queries per order.
- Entities are tracked needlessly; the bulk update loads every row into memory.

## Best Practice (How to do it right)

### 1. Projection, no tracking, keyset pagination, bulk update
```csharp
public Task<List<OrderSummary>> GetSummariesAsync(Guid customerId, DateTimeOffset? before, CancellationToken ct) =>
    db.Orders
      .AsNoTracking()
      .Where(o => o.CustomerId == customerId && (before == null || o.CreatedAt < before))
      .OrderByDescending(o => o.CreatedAt)
      .Take(50)
      .Select(o => new OrderSummary(o.Id, o.Lines.Sum(l => l.UnitPrice * l.Quantity), o.Customer.Name))
      .ToListAsync(ct);                                              // one SQL query, only needed columns

public Task<int> ExpireOldCartsAsync(DateTimeOffset now, CancellationToken ct) =>
    db.Carts
      .Where(c => c.UpdatedAt < now.AddDays(-30) && c.Status == CartStatus.Active)
      .ExecuteUpdateAsync(s => s.SetProperty(c => c.Status, CartStatus.Expired), ct);  // single UPDATE
```
```csharp
// Configuration with explicit types and a concurrency token (PostgreSQL)
public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("purchase_order");
        b.Property(o => o.TotalAmount).HasPrecision(19, 4);
        b.Property<uint>("Version").IsRowVersion();                  // maps to xmin with Npgsql
        b.HasIndex(o => new { o.CustomerId, o.CreatedAt }).IsDescending(false, true);
    }
}
```
**Why it's right:**
- Filtering, sorting, paging, and aggregation are translated to SQL; only the projected columns are read.
- The bulk update is a single statement without tracking; concurrency conflicts are detected by the database.
