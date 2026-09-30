# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Over-specified consumer contract with exact values (TypeScript, Pact JS)
```typescript
provider
  .uponReceiving('get order')
  .withRequest({ method: 'GET', path: '/orders/42' })
  .willRespondWith({
    status: 200,
    body: {
      id: 42,
      createdAt: '2024-03-01T10:15:30.123Z',     // exact timestamp
      total: 129.9,
      currency: 'EUR',
      internalWarehouseCode: 'MI-07',            // not used by the consumer
      customer: { id: 7, email: 'mario@example.com', loyaltyTier: 'GOLD' },
      lines: [ { sku: 'SKU-1', qty: 1, price: 129.9 } ],
    },
  });

// the test then calls fetch() directly instead of the real OrdersClient
```
**Why it's wrong:**
- Exact timestamps and ids force the provider to reproduce identical data, making verification brittle.
- Fields the consumer never reads (`internalWarehouseCode`, `loyaltyTier`) freeze the provider's API for no reason.
- Calling `fetch` directly means the consumer's real client and its deserialization are not tested.

### 2. Deploying without checking compatibility
```yaml
deploy-prod:
  script:
    - ./gradlew test                 # provider unit tests only
    - helm upgrade orders ./chart --set image.tag=$CI_COMMIT_SHA
```
**Why it's wrong:**
- Nothing checks whether the mobile app version currently in production still works with the new provider version.
- Compatibility problems are discovered by users after the deploy.

## Best Practice (How to do it right)

### 1. Over-specified consumer contract with exact values (TypeScript, Pact JS V4)
```typescript
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
const { like, eachLike, integer, decimal, datetime, regex } = MatchersV3;

const pact = new PactV4({ consumer: 'checkout-web', provider: 'orders-api' });

it('shows a shipped order summary', () =>
  pact
    .addInteraction()
    .given('order 42 exists and is shipped')
    .uponReceiving('a request for a shipped order')
    .withRequest('GET', '/orders/42', (b) => b.headers({ Accept: 'application/json' }))
    .willRespondWith(200, (b) =>
      b.jsonBody({
        id: integer(42),
        status: regex('SHIPPED|DELIVERED', 'SHIPPED'),
        createdAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", '2024-03-01T10:15:30.123Z'),
        total: like({ amount: decimal(129.9), currency: 'EUR' }),
        lines: eachLike({ sku: like('SKU-1'), qty: integer(1) }),
      }),
    )
    .executeTest(async (mockServer) => {
      const client = new OrdersClient({ baseUrl: mockServer.url });   // real consumer code
      const summary = await client.getOrderSummary(42);
      expect(summary.isShipped).toBe(true);
      expect(summary.itemCount).toBe(1);
    }));
```
**Why it's right:**
- Only the fields used by the consumer are in the contract, with matchers for variable data.
- The provider state is expressed in business terms and the real client code is exercised.

### 2. Deploying without checking compatibility
```yaml
# consumer and provider pipelines share the same gate
publish-pacts:            # consumer only
  script:
    - npx pact-broker publish ./pacts --consumer-app-version "$CI_COMMIT_SHA" --branch "$CI_COMMIT_BRANCH"

verify-pacts:             # provider only: real app, pacts selected from the broker
  script:
    - ./gradlew pactVerify -Ppact.provider.version="$CI_COMMIT_SHA" -Ppact.provider.branch="$CI_COMMIT_BRANCH" -Ppact.verifier.publishResults=true

deploy-prod:
  script:
    - pact-broker can-i-deploy --pacticipant orders-api --version "$CI_COMMIT_SHA" --to-environment production
    - helm upgrade orders ./chart --set image.tag="$CI_COMMIT_SHA"
    - pact-broker record-deployment --pacticipant orders-api --version "$CI_COMMIT_SHA" --environment production
```
**Why it's right:**
- Versions are git SHAs, so the broker knows exactly which consumer and provider versions are compatible.
- `can-i-deploy` blocks the release if any consumer version deployed in production would break; `record-deployment` keeps the matrix accurate.
