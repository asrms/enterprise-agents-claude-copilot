# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Sync-over-async, socket exhaustion, unbounded fan-out
```csharp
public class PriceService
{
    public decimal GetPrice(string sku)
    {
        using var client = new HttpClient();                                // new socket per call
        var json = client.GetStringAsync($"https://pricing/api/{sku}").Result; // blocks a thread-pool thread
        return decimal.Parse(json);
    }

    public async Task RefreshAll(List<string> skus)
    {
        var tasks = skus.Select(s => Task.Run(() => GetPrice(s)));          // 50,000 concurrent blocking calls
        await Task.WhenAll(tasks);
    }
}
```
**Why it's wrong:**
- `.Result` plus `Task.Run` over blocking I/O starves the thread pool under load.
- Creating `HttpClient` per call exhausts sockets and ignores DNS changes; there is no timeout, retry, or cancellation.
- The fan-out is unbounded and overloads the pricing service.

## Best Practice (How to do it right)

### 1. Typed client with resilience, cancellation, and bounded parallelism
```csharp
builder.Services.AddHttpClient<PricingClient>(c => c.BaseAddress = new Uri("https://pricing/"))
    .AddStandardResilienceHandler();

public sealed class PricingClient(HttpClient http)
{
    public async Task<decimal> GetPriceAsync(string sku, CancellationToken ct)
    {
        var dto = await http.GetFromJsonAsync($"api/{Uri.EscapeDataString(sku)}", PricingJsonContext.Default.PriceDto, ct);
        return dto!.Amount;
    }
}

public sealed class PriceRefresher(PricingClient pricing, IPriceStore store)
{
    public Task RefreshAllAsync(IReadOnlyList<string> skus, CancellationToken ct) =>
        Parallel.ForEachAsync(skus, new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct },
            async (sku, token) => await store.SaveAsync(sku, await pricing.GetPriceAsync(sku, token), token));
}

[JsonSerializable(typeof(PriceDto))]
internal partial class PricingJsonContext : JsonSerializerContext;
```
### 2. Bounded channel with a background consumer
```csharp
public sealed class EmailQueue
{
    private readonly Channel<EmailMessage> _channel =
        Channel.CreateBounded<EmailMessage>(new BoundedChannelOptions(1_000) { FullMode = BoundedChannelFullMode.Wait });
    public ValueTask EnqueueAsync(EmailMessage m, CancellationToken ct) => _channel.Writer.WriteAsync(m, ct);
    public IAsyncEnumerable<EmailMessage> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class EmailSender(EmailQueue queue, ISmtpGateway smtp, ILogger<EmailSender> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.ReadAllAsync(stoppingToken))
        {
            try { await smtp.SendAsync(message, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { log.LogError(ex, "Email {Id} failed", message.Id); }
        }
    }
}
```
**Why it's right:**
- No thread is blocked; the factory manages connections and the resilience handler adds timeouts, retries, and circuit breaking.
- Parallelism is bounded and cancellable; JSON uses source generation.
- Background work is bounded by the channel capacity and failures are logged instead of lost.
