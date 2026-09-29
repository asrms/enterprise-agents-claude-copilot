# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Environment variables and API responses used without validation
```ts
// lib/catalog-client.ts
export type Product = {
  id: string;
  name: string;
  priceCents: number;
  tags?: string[];
};

const API_URL = process.env.CATALOG_API_URL!;
const API_TOKEN = process.env.CATALOG_API_TOKEN as string;

export async function getProducts(category: any): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products?category=${category}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  const data = (await res.json()) as Product[];
  return data;
}

export async function getFirstTag(productId: string) {
  try {
    const products = await getProducts('all');
    const product = products.find((p) => p.id === productId)!;
    return product.tags![0].toUpperCase();
  } catch (e: any) {
    console.error(e.message);
    return null;
  }
}
```
**Why it's wrong:** `!` and `as string` on the env hide a missing configuration that surfaces at runtime as the URL `undefined/products`; `as Product[]` blindly trusts an external API; `category: any` disables type checks and allows parameters to be injected into the query string; the `!` on `find` and `tags` turn an expected case into a crash, and `catch (e: any)` reads `.message` without narrowing.

### 2. Async state modeled with booleans and a non-exhaustive switch
```tsx
// features/payments/components/payment-status.tsx
type PaymentMethod = 'card' | 'sepa' | 'paypal';

type PaymentState = {
  isLoading: boolean;
  isError: boolean;
  isRefunded?: boolean;
  data?: { amountCents: number; paidAt: string };
  error?: string;
};

function methodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'card':
      return 'Credit card';
    case 'sepa':
      return 'SEPA transfer';
  }
  return 'Unknown'; // 'paypal' ends up here without any compile error
}

export function PaymentStatus({ state, method }: { state: PaymentState; method: PaymentMethod }) {
  if (state.isLoading) return <p>Loading…</p>;
  if (state.isError) return <p role="alert">{state.error}</p>;
  // isLoading=false, isError=false, and no data: an impossible yet representable state
  return (
    <p>
      {methodLabel(method)}: {state.data!.amountCents / 100} € on {state.data!.paidAt}
      {state.isRefunded && ' (refunded)'}
    </p>
  );
}
```
**Why it's wrong:** three booleans and two optional fields generate dozens of combinations, many impossible yet accepted by the compiler; the `!` on `data` push the problem to runtime; the `switch` is not exhaustive and the new `paypal` method silently falls back to "Unknown".

### 3. Interchangeable primitive IDs and unvalidated searchParams
```tsx
// features/refunds/server/refund-service.ts
import 'server-only';
import { db } from '@/lib/db';

export async function refundOrder(orderId: string, customerId: string, amountCents: number): Promise<void> {
  await db.refund.create({ data: { orderId, customerId, amountCents } });
}

export async function approveRefundRequest(request: { orderId: string; customerId: string; amountCents: number }) {
  // swapped arguments: it compiles because both are strings
  await refundOrder(request.customerId, request.orderId, request.amountCents);
}

// app/(admin)/refunds/page.tsx
import { listRefunds } from '@/features/refunds/server/queries';
import { RefundTable } from '@/features/refunds/components/refund-table';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RefundsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Number(sp.page as string) || 1; // "-5" → -5, "1e9" → 1000000000
  const status = sp.status as 'open' | 'closed'; // any string passes the cast
  const refunds = await listRefunds({ page, status });
  return <RefundTable refunds={refunds} />;
}
```
**Why it's wrong:** `string` IDs are interchangeable, and swapping arguments creates incorrect refunds without any error; the casts on `searchParams` accept negative, huge, or arbitrary values that flow straight into the query; `sp.page` can also be an array and the cast hides it.

## Best Practice (How to do it right)

### 1. Environment variables and API responses used without validation
```ts
// lib/env.ts
import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  CATALOG_API_URL: z.url(), // Zod 4; in Zod 3: z.string().url()
  CATALOG_API_TOKEN: z.string().min(32),
});

// fails at startup if the configuration is incomplete
export const env = EnvSchema.parse(process.env);

// features/catalog/server/catalog-client.ts
import 'server-only';
import { z } from 'zod';
import { env } from '@/lib/env';

const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  priceCents: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([]),
});
const ProductListSchema = z.array(ProductSchema);
export type Product = z.infer<typeof ProductSchema>;

export const CategorySchema = z.enum(['all', 'hardware', 'software', 'services']);
export type Category = z.infer<typeof CategorySchema>;

export async function getProducts(category: Category): Promise<Product[]> {
  const url = new URL('/products', env.CATALOG_API_URL);
  url.searchParams.set('category', category);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.CATALOG_API_TOKEN}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Catalog API ${String(res.status)}`);
  const json: unknown = await res.json();
  return ProductListSchema.parse(json);
}

export async function getFirstTag(productId: string): Promise<string | null> {
  const products = await getProducts('all');
  // noUncheckedIndexedAccess: tags[0] is string | undefined
  const firstTag = products.find((p) => p.id === productId)?.tags[0];
  return firstTag?.toUpperCase() ?? null;
}
```
**Why it's right:** the env is validated once in a `server-only` module and the app does not start with a wrong configuration; the API response goes from `unknown` to `Product[]` only through Zod, and the type is derived with `z.infer`; `Category` is a closed union and the URL is built with `URLSearchParams`; missing data is handled with `?.`/`??` instead of `!`.

### 2. Async state modeled with booleans and a non-exhaustive switch
```tsx
// lib/assert-never.ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

// features/payments/components/payment-status.tsx
import { assertNever } from '@/lib/assert-never';

type PaymentMethod = 'card' | 'sepa' | 'paypal';

export type PaymentState =
  | { status: 'loading' }
  | { status: 'failed'; error: string }
  | { status: 'paid'; amountCents: number; paidAt: Date }
  | { status: 'refunded'; amountCents: number; refundedAt: Date };

// satisfies: the compiler immediately flags a method without a label
const METHOD_LABELS = {
  card: 'Credit card',
  sepa: 'SEPA transfer',
  paypal: 'PayPal',
} as const satisfies Record<PaymentMethod, string>;

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const day = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' });

export function PaymentStatus({ state, method }: { state: PaymentState; method: PaymentMethod }) {
  switch (state.status) {
    case 'loading':
      return <p role="status">Loading…</p>;
    case 'failed':
      return <p role="alert">{state.error}</p>;
    case 'paid':
      return (
        <p>
          {METHOD_LABELS[method]}: {euro.format(state.amountCents / 100)} on {day.format(state.paidAt)}
        </p>
      );
    case 'refunded':
      return <p>Refunded {euro.format(state.amountCents / 100)} on {day.format(state.refundedAt)}</p>;
    default:
      return assertNever(state); // a new variant breaks compilation
  }
}
```
**Why it's right:** the discriminated union makes only valid states representable, and narrowing on `status` gives access to fields without `!`; `assertNever` makes the switch exhaustive at compile time; `satisfies` verifies that every `PaymentMethod` has a label while preserving literal types.

### 3. Interchangeable primitive IDs and unvalidated searchParams
```tsx
// features/refunds/schemas.ts
import { z } from 'zod';

export const OrderIdSchema = z.uuid().brand<'OrderId'>();
export const CustomerIdSchema = z.uuid().brand<'CustomerId'>();
export type OrderId = z.infer<typeof OrderIdSchema>;
export type CustomerId = z.infer<typeof CustomerIdSchema>;

export const RefundListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1),
  status: z.enum(['open', 'closed']).catch('open'),
});
export type RefundListParams = z.infer<typeof RefundListParamsSchema>;

// features/refunds/server/refund-service.ts
import 'server-only';
import { db } from '@/lib/db';
import type { CustomerId, OrderId } from '@/features/refunds/schemas';

export async function refundOrder(orderId: OrderId, customerId: CustomerId, amountCents: number): Promise<void> {
  await db.refund.create({ data: { orderId, customerId, amountCents } });
}
// refundOrder(customerId, orderId, amount) → compile error

// app/(admin)/refunds/page.tsx
import { RefundListParamsSchema } from '@/features/refunds/schemas';
import { listRefunds } from '@/features/refunds/server/queries';
import { RefundTable } from '@/features/refunds/components/refund-table';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RefundsPage({ searchParams }: Props) {
  // invalid, out-of-range, or array values fall back to defaults thanks to .catch()
  const params = RefundListParamsSchema.parse(await searchParams);
  const refunds = await listRefunds(params);
  return <RefundTable refunds={refunds} />;
}
```
**Why it's right:** branded types make `OrderId` and `CustomerId` non-interchangeable, and they can only be obtained through the parser; the `searchParams` schema applies coercion, bounds, and safe defaults and returns a typed `RefundListParams`; no casts, types derived with `z.infer`.
