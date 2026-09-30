# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Waterfall of sequential `await` calls with no cache strategy
```tsx
// app/(shop)/products/[slug]/page.tsx
import { ProductGallery } from '@/features/catalog/components/product-gallery';
import { ReviewList } from '@/features/reviews/components/review-list';
import { RelatedProducts } from '@/features/catalog/components/related-products';

const API = process.env.CATALOG_API_URL;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1st request
  const product = await fetch(`${API}/products/${slug}`).then((r) => r.json());
  // 2nd request: starts only after the first even though it does not depend on it
  const reviews = await fetch(`${API}/products/${slug}/reviews`).then((r) => r.json());
  // 3rd request: slow recommendation engine, blocks the entire page
  const related = await fetch(`${API}/recommendations?slug=${slug}`).then((r) => r.json());

  return (
    <main>
      <h1>{product.name}</h1>
      <ProductGallery images={product.images} />
      <ReviewList reviews={reviews} />
      <RelatedProducts products={related} />
    </main>
  );
}
```
**Why it's wrong:** TTFB is the sum of the three latencies; in Next 15+ no `fetch` is cached, so every visit hits the API; without `<Suspense>` the slowest section delays all the HTML and the LCP; `res.ok` is not checked and `r.json()` returns unvalidated `any`.

### 2. Mutation via Route Handler and `router.refresh()`
```tsx
// features/todos/components/add-todo-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function AddTodoForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      setError('Error');
      return;
    }
    setTitle('');
    router.refresh(); // refreshes only this client: the Data Cache with tag 'todos' stays stale
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => { setTitle(e.target.value); }} />
      <button>Add</button>
      {error && <span>{error}</span>}
    </form>
  );
}
```
**Why it's wrong:** it requires an extra REST endpoint with duplicated validation; the form does not work without JavaScript and has no pending state (double submit); `router.refresh()` does not invalidate the Data Cache, so other users and other pages see stale data; the error is generic and not announced.

### 3. Cache Components in Next 16 used with runtime APIs
```tsx
// app/(shop)/categories/[id]/page.tsx — Next 16 with cacheComponents: true
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import { CartSummary } from '@/features/cart/components/cart-summary';

export const revalidate = 3600; // segment config incompatible with Cache Components

async function getCategoryProducts(categoryId: string) {
  'use cache';
  cacheLife('hours');
  // runtime API inside 'use cache': error, and the locale is not part of the cache key
  const locale = (await cookies()).get('locale')?.value ?? 'it';
  const res = await fetch(`https://api.example.com/categories/${categoryId}/products?locale=${locale}`);
  return res.json();
}

async function getCart() {
  'use cache'; // per-user cart in a shared cache
  const cartId = (await cookies()).get('cart_id')?.value;
  const res = await fetch(`https://api.example.com/carts/${cartId ?? ''}`);
  return res.json();
}

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, cart] = await Promise.all([getCategoryProducts(id), getCart()]);
  return (
    <main>
      <CartSummary cart={cart} />
      <ProductGrid products={products} />
    </main>
  );
}
```
**Why it's wrong:** `export const revalidate` is incompatible with Cache Components; `cookies()` inside `'use cache'` is forbidden and, conceptually, the locale would be left out of the key; caching the cart risks showing it to other users; `cacheTag` is missing, so the products cannot be invalidated, and without `<Suspense>` the dynamic parts block the page.

## Best Practice (How to do it right)

### 1. Waterfall of sequential `await` calls with no cache strategy
```tsx
// features/catalog/server/queries.ts
import 'server-only';
import { cache } from 'react';
import { env } from '@/lib/env';
import { ProductSchema, ReviewListSchema, type Product, type Review } from '@/features/catalog/schemas';

const productUrl = (slug: string) => `${env.CATALOG_API_URL}/products/${encodeURIComponent(slug)}`;

export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  const res = await fetch(productUrl(slug), {
    next: { revalidate: 3600, tags: ['products', `product:${slug}`] }, // ISR 1h + tags
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Catalog API ${String(res.status)}`);
  return ProductSchema.parse(await res.json());
});

export async function getReviews(slug: string): Promise<Review[]> {
  const res = await fetch(`${productUrl(slug)}/reviews`, { next: { revalidate: 300, tags: [`reviews:${slug}`] } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Reviews API ${String(res.status)}`);
  return ReviewListSchema.parse(await res.json());
}

// app/(shop)/products/[slug]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProduct, getReviews } from '@/features/catalog/server/queries';
import { ProductGallery } from '@/features/catalog/components/product-gallery';
import { ReviewList } from '@/features/reviews/components/review-list';
import { RelatedProducts, RelatedProductsSkeleton } from '@/features/catalog/components/related-products';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // independent requests started together: latency = maximum, not sum
  const [product, reviews] = await Promise.all([getProduct(slug), getReviews(slug)]);
  if (!product) notFound();

  return (
    <main>
      <h1>{product.name}</h1>
      <ProductGallery images={product.images} />
      <ReviewList reviews={reviews} />
      {/* slow recommendations streamed in: they block neither the shell nor the LCP */}
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProducts slug={slug} />
      </Suspense>
    </main>
  );
}
```
**Why it's right:** every `fetch` declares `revalidate` and `tags`, so it is cached and can be invalidated in a targeted way; `Promise.all` eliminates the waterfall; the slow section is an async Server Component streamed under `<Suspense>`; `res.ok`, 404 handling, and Zod parsing make the data reliable and typed.

### 2. Mutation via Route Handler and `router.refresh()`
```tsx
// features/todos/actions.ts
'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { todoRepository } from '@/features/todos/server/todo-repository';

const AddTodoSchema = z.object({ title: z.string().trim().min(1, 'Title is required').max(120) });

export type AddTodoState = { status: 'idle' } | { status: 'success' } | { status: 'error'; message: string };

export async function addTodo(_prev: AddTodoState, formData: FormData): Promise<AddTodoState> {
  const user = await requireUser();
  const parsed = AddTodoSchema.safeParse({ title: formData.get('title') });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  await todoRepository.create({ ownerId: user.id, title: parsed.data.title });
  // Next 15; in Next 16: updateTag(`todos:${user.id}`) for read-your-writes
  revalidateTag(`todos:${user.id}`);
  return { status: 'success' };
}

// features/todos/components/add-todo-form.tsx
'use client';

import { useActionState } from 'react';
import { addTodo, type AddTodoState } from '@/features/todos/actions';

const initialState: AddTodoState = { status: 'idle' };

export function AddTodoForm() {
  const [state, formAction, isPending] = useActionState(addTodo, initialState);
  return (
    <form action={formAction}>
      <label htmlFor="todo-title">New task</label>
      <input id="todo-title" name="title" required maxLength={120} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Add'}
      </button>
      <p role="status">{state.status === 'error' ? state.message : ''}</p>
    </form>
  );
}
```
**Why it's right:** the Server Action validates with Zod, derives the user from the session, and invalidates the specific tag, so every page that reads that data is updated; `useActionState` provides pending state and typed errors; the `<form action>` works even before hydration, and React automatically resets the form after success.

### 3. Cache Components in Next 16 used with runtime APIs
```tsx
// features/catalog/server/queries.ts — next.config.ts: { cacheComponents: true }
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { env } from '@/lib/env';
import { ProductListSchema, type Locale, type Product } from '@/features/catalog/schemas';

export async function getCategoryProducts(categoryId: string, locale: Locale): Promise<Product[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('products', `category:${categoryId}`);
  const url = `${env.CATALOG_API_URL}/categories/${encodeURIComponent(categoryId)}/products?locale=${locale}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalog API ${String(res.status)}`);
  return ProductListSchema.parse(await res.json());
}

// app/(shop)/categories/[id]/page.tsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getCategoryProducts } from '@/features/catalog/server/queries';
import { LocaleSchema } from '@/features/catalog/schemas';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/components/product-grid';
import { CartSummary, CartSummarySkeleton } from '@/features/cart/components/cart-summary';

type Props = { params: Promise<{ id: string }> };

export default function CategoryPage({ params }: Props) {
  return (
    <main>
      {/* per-user: CartSummary reads cookies() at runtime, without caching */}
      <Suspense fallback={<CartSummarySkeleton />}>
        <CartSummary />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <CategoryProducts params={params} />
      </Suspense>
    </main>
  );
}

async function CategoryProducts({ params }: Props) {
  const { id } = await params;
  const locale = LocaleSchema.catch('it').parse((await cookies()).get('locale')?.value);
  const products = await getCategoryProducts(id, locale); // locale in the cache key
  return <ProductGrid products={products} />;
}
```
**Why it's right:** `'use cache'` with `cacheLife` and `cacheTag` replaces the segment config and makes products invalidatable per category; runtime values (the locale cookie) are read outside and passed as arguments, so they become part of the cache key; the per-user cart is never cached and, like every runtime access, is isolated under `<Suspense>`.
