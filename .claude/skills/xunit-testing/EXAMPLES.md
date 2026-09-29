# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. InMemory provider, real clock, sleeps, and vague assertions
```csharp
public class OrderTests
{
    [Fact]
    public async Task Test1()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("db").Options;
        var db = new AppDbContext(options);                     // shared name: state leaks between tests
        var service = new OrderService(db);

        await service.PlaceAsync(new PlaceOrder(customerId, items));
        Thread.Sleep(2000);                                     // wait for the background handler
        Assert.True(db.Orders.Any());
        Assert.True(DateTime.Now > db.Orders.First().CreatedAt); // depends on the real clock
    }
}
```
**Why it's wrong:**
- The InMemory provider does not enforce constraints or translate SQL, so the test proves little.
- Sleeps make the test slow and flaky; the name and assertions do not describe the behavior.

## Best Practice (How to do it right)

### 1. Unit test with a fake clock and a theory
```csharp
public class OrderTests
{
    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero));

    [Theory]
    [InlineData(OrderStatus.Paid)]
    [InlineData(OrderStatus.Cancelled)]
    public void Pay_WhenOrderIsNotPending_Throws(OrderStatus status)
    {
        var order = OrderMother.WithStatus(status, _clock);

        var act = () => order.Pay(order.Total);

        Assert.Throws<DomainException>(act);
    }
}
```
### 2. API integration test with WebApplicationFactory and Testcontainers
```csharp
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder().WithImage("postgres:17").Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting("ConnectionStrings:Shop", _db.GetConnectionString())
               .ConfigureTestServices(s => s.AddAuthentication(TestAuthHandler.Scheme)
                   .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.Scheme, _ => { }));

    public async ValueTask InitializeAsync() { await _db.StartAsync(); await MigrateAsync(_db.GetConnectionString()); }
    public override async ValueTask DisposeAsync() { await _db.DisposeAsync(); await base.DisposeAsync(); }
}

[Collection(nameof(ApiCollection))]
public sealed class CreateOrderEndpointTests(ApiFactory factory)
{
    [Fact]
    public async Task Post_WithEmptyItems_ReturnsValidationProblem()
    {
        var client = factory.CreateClient().AsCustomer("c-42");

        var response = await client.PostAsJsonAsync("/v1/orders", new { items = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
```
**Why it's right:**
- Domain tests are fast, deterministic, and parameterized; names state the expected behavior.
- API tests exercise the real pipeline, authentication, and database engine, shared once per collection.
