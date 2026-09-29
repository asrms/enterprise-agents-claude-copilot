# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Weak token validation, role-only checks, secrets in config
```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = false,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("super-secret-key-1234567890123456")),
    };
});

app.MapGet("/invoices/{id:guid}", [Authorize(Roles = "Customer")] async (Guid id, AppDbContext db) =>
    await db.Invoices.FindAsync(id));   // any customer can read any invoice
```
**Why it's wrong:**
- Tokens from any issuer or audience, including expired ones, are accepted; the signing key is hard-coded.
- The role check does not verify ownership: an insecure direct object reference.

## Best Practice (How to do it right)

### 1. Validated JWT, fallback policy, and resource-based authorization
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = builder.Configuration["Auth:Authority"];      // metadata and keys from the IdP
        o.Audience = builder.Configuration["Auth:Audience"];
        o.MapInboundClaims = false;
        o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
    });

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy("invoices:read", p => p.RequireClaim("scope", "invoices:read"));

builder.Services.AddSingleton<IAuthorizationHandler, InvoiceOwnerHandler>();
builder.Configuration.AddAzureKeyVault(new Uri(builder.Configuration["KeyVault:Uri"]!), new DefaultAzureCredential());

app.MapGet("/invoices/{id:guid}", async Task<Results<Ok<InvoiceResponse>, NotFound, ForbidHttpResult>> (
        Guid id, ClaimsPrincipal user, IInvoiceQueries invoices, IAuthorizationService authz, CancellationToken ct) =>
    {
        var invoice = await invoices.FindAsync(id, ct);
        if (invoice is null) return TypedResults.NotFound();
        var result = await authz.AuthorizeAsync(user, invoice, new OwnerRequirement());
        return result.Succeeded ? TypedResults.Ok(InvoiceResponse.From(invoice)) : TypedResults.Forbid();
    })
    .RequireAuthorization("invoices:read");

public sealed class InvoiceOwnerHandler : AuthorizationHandler<OwnerRequirement, Invoice>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx, OwnerRequirement req, Invoice invoice)
    {
        if (invoice.CustomerId == ctx.User.FindFirstValue("sub")) ctx.Succeed(req);
        return Task.CompletedTask;
    }
}
```
**Why it's right:**
- Issuer, audience, lifetime, and keys are validated against the identity provider; secrets come from Key Vault with a managed identity.
- Every endpoint requires authentication by default, scopes are enforced by policy, and ownership is checked per resource.
