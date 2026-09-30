# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Vendor lock-in, unstructured logs, high-cardinality labels (Node.js)
```typescript
import vendorApm from 'some-vendor-apm';                       // vendor SDK called from business code
const requests = new promClient.Counter({ name: 'requests', help: 'x', labelNames: ['url', 'userId'] });

app.get('/orders/:id', async (req, reply) => {
  requests.inc({ url: req.url, userId: req.user.id });         // one time series per URL and user
  console.log('loading order ' + req.params.id + ' for ' + req.user.email);   // unstructured, PII, no trace id
  vendorApm.startSpan('GET /orders/' + req.params.id);          // span name per order id
});
```
**Why it's wrong:**
- Metric labels and span names explode cardinality, driving cost up and making queries slow.
- Logs are unstructured, contain personal data, and cannot be correlated with traces.
- Business code is coupled to one vendor.

## Best Practice (How to do it right)

### 1. OpenTelemetry in .NET with OTLP export
```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("orders-api", serviceVersion: AppInfo.Version))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource(Telemetry.ActivitySource.Name)
        .AddOtlpExporter())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter(Telemetry.Meter.Name)
        .AddOtlpExporter());
builder.Logging.AddOpenTelemetry(o => { o.IncludeScopes = true; o.AddOtlpExporter(); });

public static class Telemetry
{
    public static readonly ActivitySource ActivitySource = new("Acme.Orders");
    public static readonly Meter Meter = new("Acme.Orders");
    public static readonly Counter<long> OrdersPlaced = Meter.CreateCounter<long>("orders.placed", unit: "{order}");
}

using var activity = Telemetry.ActivitySource.StartActivity("PlaceOrder");
activity?.SetTag("order.item_count", command.Items.Count);
Telemetry.OrdersPlaced.Add(1, new KeyValuePair<string, object?>("payment.method", command.PaymentMethod));
logger.LogInformation("Order {OrderId} placed with {ItemCount} items", order.Id, command.Items.Count);
```
### 2. Collector with tail sampling
```yaml
receivers:
  otlp:
    protocols: { grpc: {}, http: {} }
processors:
  memory_limiter: { check_interval: 1s, limit_percentage: 80, spike_limit_percentage: 20 }
  tail_sampling:
    decision_wait: 10s
    policies:
      - { name: errors, type: status_code, status_code: { status_codes: [ERROR] } }
      - { name: slow, type: latency, latency: { threshold_ms: 1000 } }
      - { name: baseline, type: probabilistic, probabilistic: { sampling_percentage: 10 } }
  batch: {}
exporters:
  otlp/traces: { endpoint: tempo:4317 }
  prometheusremotewrite: { endpoint: http://prometheus:9090/api/v1/write }
service:
  pipelines:
    traces:  { receivers: [otlp], processors: [memory_limiter, tail_sampling, batch], exporters: [otlp/traces] }
    metrics: { receivers: [otlp], processors: [memory_limiter, batch], exporters: [prometheusremotewrite] }
```
**Why it's right:**
- Vendor-neutral instrumentation with standard resource attributes; the Collector decides where data goes.
- Metric attributes are low-cardinality, logs are structured and correlated with traces automatically.
- All errors and slow traces are kept while normal traffic is sampled, with memory limits in the Collector.
