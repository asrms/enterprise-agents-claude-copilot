# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Entity binding, blocking calls, raw exceptions
```csharp
app.MapPost("/orders", (Order order, AppDbContext db) =>
{
    db.Orders.Add(order);                         // client sets Id, Status, Total, CustomerId
    db.SaveChangesAsync().Wait();                 // blocks a thread-pool thread
    return Results.Ok(order);                     // returns the entity, 200 instead of 201
});

app.MapGet("/orders/{id}", (int id, AppDbContext db) =>
{
    try { return Results.Ok(db.Orders.Include(o => o.Customer).First(o => o.Id == id)); }
    catch (Exception ex) { return Results.Problem(ex.ToString()); }   // leaks stack trace
});
```
**Why it's wrong:**
- Binding the EF Core entity enables overposting; the response exposes internal fields and relations.
- `.Wait()` causes thread-pool starvation under load; no cancellation, validation, or authorization.
- Exception details are returned to the client, and "not found" becomes a 500.

## Best Practice (How to do it right)

### 1. Feature endpoints with typed results, validation, and policies
```csharp
public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrders(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/orders")
            .WithTags("Orders")
            .RequireAuthorization()
            .RequireRateLimiting("per-user");

        group.MapPost("/", CreateAsync).WithName("CreateOrder").RequireAuthorization("orders:write");
        group.MapGet("/{id:guid}", GetAsync).WithName("GetOrder");
        return group;
    }

    private static async Task<Results<Created<OrderResponse>, ValidationProblem>> CreateAsync(
        CreateOrderRequest request, IValidator<CreateOrderRequest> validator,
        PlaceOrderHandler handler, ClaimsPrincipal user, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid) return TypedResults.ValidationProblem(validation.ToDictionary());

        var order = await handler.HandleAsync(new PlaceOrder(user.GetCustomerId(), request.Items), ct);
        return TypedResults.Created($"/v1/orders/{order.Id}", OrderResponse.From(order));
    }

    private static async Task<Results<Ok<OrderResponse>, NotFound>> GetAsync(
        Guid id, IOrderQueries queries, ClaimsPrincipal user, CancellationToken ct)
    {
        var order = await queries.FindForCustomerAsync(id, user.GetCustomerId(), ct);
        return order is null ? TypedResults.NotFound() : TypedResults.Ok(order);
    }
}

public sealed record CreateOrderRequest(IReadOnlyList<OrderItemRequest> Items);
public sealed record OrderItemRequest(string Sku, int Quantity);
```
```csharp
// Program.cs
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddOptions<PaymentOptions>().BindConfiguration("Payment").ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddRateLimiter(o => o.AddTokenBucketLimiter("per-user", l =>
    { l.TokenLimit = 100; l.TokensPerPeriod = 100; l.ReplenishmentPeriod = TimeSpan.FromMinutes(1); }));

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapOpenApi();
app.MapOrders();
app.MapHealthChecks("/health/ready");
app.Run();
```
**Why it's right:**
- Request and response records prevent overposting; typed results document every status code in OpenAPI.
- Validation, authorization policies, rate limiting, and cancellation are applied to every endpoint.
- Exceptions are mapped centrally to problem details, and options are validated at startup.
