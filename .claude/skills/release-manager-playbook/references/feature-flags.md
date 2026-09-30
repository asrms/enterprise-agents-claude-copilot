# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Scattered, client-side, never-removed flags
```typescript
// shipped to the browser bundle
if (flags.newCheckout && flags.newCheckoutV2 && !flags.disableNewCheckout) {   // nested and contradictory
  applyDiscount(cart, 0.1)                                                     // pricing decided client-side
}
// ...the same condition copy-pasted in 14 files; flag created in 2023, still there
```
**Why it's wrong:**
- Users can flip client-side flags to change prices; nested flags make behavior impossible to reason about.
- Scattered checks and missing ownership turn the flag into permanent technical debt.

## Best Practice (How to do it right)

### 1. OpenFeature evaluation at one decision point, with a safe default
```typescript
import { OpenFeature } from '@openfeature/server-sdk'
import { FlagdProvider } from '@openfeature/flagd-provider'

await OpenFeature.setProviderAndWait(new FlagdProvider())
const flags = OpenFeature.getClient('checkout')

export async function selectCheckoutFlow(ctx: { userId: string; tenantId: string }): Promise<CheckoutFlow> {
  const enabled = await flags.getBooleanValue(
    'checkout-v2-enabled',                          // owner: team-payments, ticket PAY-311, remove by 2026-11-30
    false,                                          // safe default: current flow
    { targetingKey: ctx.userId, tenantId: ctx.tenantId },
  )
  return enabled ? new CheckoutV2Flow() : new CheckoutV1Flow()
}
```
`flags.flagd.json`:
```json
{
  "flags": {
    "checkout-v2-enabled": {
      "state": "ENABLED",
      "variants": { "on": true, "off": false },
      "defaultVariant": "off",
      "targeting": {
        "if": [
          { "in": [{ "var": "tenantId" }, ["internal", "beta-tenant-7"]] }, "on",
          { "fractional": [[ "on", 10 ], [ "off", 90 ]] }
        ]
      }
    }
  }
}
```
### 2. Tests for both variants with an in-memory provider
```typescript
import { InMemoryProvider, OpenFeature } from '@openfeature/server-sdk'

it.each([[true, CheckoutV2Flow], [false, CheckoutV1Flow]])('flag=%s selects the right flow', async (on, Flow) => {
  await OpenFeature.setProviderAndWait(new InMemoryProvider({
    'checkout-v2-enabled': { variants: { on: true, off: false }, defaultVariant: on ? 'on' : 'off', disabled: false },
  }))
  expect(await selectCheckoutFlow({ userId: 'u-1', tenantId: 't-1' })).toBeInstanceOf(Flow)
})
```
**Why it's right:**
- The flag is evaluated server-side at a single decision point with a safe default and documented owner and removal date.
- Rollout targets internal and beta tenants first, then 10% of users by stable key; both variants are tested.
