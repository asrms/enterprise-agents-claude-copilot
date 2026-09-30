# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Detail page loaded with `useEffect` on the client
```tsx
// app/(shop)/orders/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Order = { id: string; status: string; items: { sku: string; qty: number }[] };

export default function OrderPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${params.id}`)
      .then((res) => res.json())
      .then((data: Order) => { setOrder(data); })
      .finally(() => { setLoading(false); });
  }, [params.id]);

  if (loading) return <p>Loading...</p>;
  if (!order) return <p>Order not found</p>;

  return (
    <main>
      <h1>Order {order.id}</h1>
      <p>Status: {order.status}</p>
      <ul>
        {order.items.map((item, i) => (
          <li key={i}>{item.sku} × {item.qty}</li>
        ))}
      </ul>
      <button onClick={() => fetch(`/api/orders/${params.id}/cancel`, { method: 'POST' })}>
        Cancel order
      </button>
    </main>
  );
}
```
**Why it's wrong:** the whole page becomes client JS and data arrives only after HTML → bundle → fetch (waterfall and slow LCP); `params` is treated as a synchronous object, while in Next 15+ it is a `Promise`; "Order not found" is served with status 200; the JSON is neither validated nor checked with `res.ok`, and the `key` uses the index.

### 2. `'use client'` directive in the section layout
```tsx
// app/(dashboard)/layout.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { NotificationsFeed } from '@/features/notifications/components/notifications-feed';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? 'layout layout--collapsed' : 'layout'}>
      <Sidebar collapsed={collapsed} />
      <div className="toggle" onClick={() => { setCollapsed((c) => !c); }}>
        ☰
      </div>
      {/* NotificationsFeed is now client code: it must load data with useEffect */}
      <NotificationsFeed />
      <main>{children}</main>
    </div>
  );
}
```
**Why it's wrong:** `'use client'` in the layout turns `Sidebar`, `NotificationsFeed`, and all their imports into client code, bloating the bundle of every page in the section; those components can no longer be `async` or read data on the server; the state of a single toggle forces the entire layout onto the client; the toggle is a `div` that is not keyboard-reachable.

### 3. ORM entities and secrets passed to a Client Component
```tsx
// app/(dashboard)/customers/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import { CustomerCard } from './customer-card';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // full record: passwordHash, internal notes, Decimal fields
  const customer = await prisma.customer.findUnique({ where: { id }, include: { invoices: true } });
  return <CustomerCard customer={customer} billingApiKey={process.env.BILLING_API_KEY ?? ''} />;
}

// app/(dashboard)/customers/[id]/customer-card.tsx
'use client';

import type { Customer, Invoice } from '@prisma/client';

type Props = { customer: (Customer & { invoices: Invoice[] }) | null; billingApiKey: string };

export function CustomerCard({ customer, billingApiKey }: Props) {
  if (!customer) return <p>Customer not found</p>;
  const download = (invoiceId: string) => {
    window.open(`https://billing.example.com/invoices/${invoiceId}.pdf?key=${billingApiKey}`);
  };
  return (
    <section>
      <h1>{customer.name}</h1>
      <p>Remaining credit: {customer.creditBalance.toString()}</p>
      {customer.invoices.map((invoice) => (
        <button key={invoice.id} type="button" onClick={() => { download(invoice.id); }}>
          Download invoice {invoice.number}
        </button>
      ))}
    </section>
  );
}
```
**Why it's wrong:** `Decimal` is not serializable and triggers the error "Only plain objects can be passed to Client Components"; `passwordHash` and internal notes end up in the RSC payload visible in the page source; the billing API key is exposed in the HTML and in the URL; there is no check that the user is allowed to see that customer (IDOR), and the "not found" case responds with 200.

## Best Practice (How to do it right)

### 1. Detail page loaded with `useEffect` on the client
```tsx
// app/(shop)/orders/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/features/orders/server/queries';
import { CancelOrderButton } from '@/features/orders/components/cancel-order-button';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrderDetail(id); // deduplicated with React.cache()
  return { title: order ? `Order ${order.code}` : 'Order not found' };
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound(); // status 404 + not-found.tsx; narrows the type

  return (
    <main>
      <h1>Order {order.code}</h1>
      <p>Status: {order.statusLabel}</p>
      <ul>
        {order.items.map((item) => (
          <li key={item.sku}>{item.name} × {item.qty}</li>
        ))}
      </ul>
      {order.cancellable && <CancelOrderButton orderId={order.id} />}
    </main>
  );
}

// features/orders/components/cancel-order-button.tsx
'use client';

import { useTransition } from 'react';
import { cancelOrder } from '@/features/orders/actions';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => { startTransition(async () => { await cancelOrder(orderId); }); }}
    >
      {isPending ? 'Cancelling…' : 'Cancel order'}
    </button>
  );
}
```
**Why it's right:** the page is an `async` Server Component that sends pre-populated HTML with no rendering JS; `params` is awaited as a `Promise` per Next 15+; `notFound()` produces a real 404 and narrows the type without `!`; only the interactive button is a Client Component, and the mutation goes through a Server Action.

### 2. `'use client'` directive in the section layout
```tsx
// app/(dashboard)/layout.tsx
import { Suspense, type ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { SidebarShell } from '@/components/sidebar-shell';
import { NotificationsFeed } from '@/features/notifications/components/notifications-feed';
import { NotificationsSkeleton } from '@/features/notifications/components/notifications-skeleton';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarShell sidebar={<Sidebar />}>
      {/* Async Server Component streamed in, passed as a slot */}
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsFeed />
      </Suspense>
      <main id="main-content">{children}</main>
    </SidebarShell>
  );
}

// components/sidebar-shell.tsx
'use client';

import { useState, type ReactNode } from 'react';

type Props = { sidebar: ReactNode; children: ReactNode };

export function SidebarShell({ sidebar, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="layout" data-collapsed={collapsed}>
      <nav id="sidebar" aria-label="Main navigation">{sidebar}</nav>
      <button
        type="button"
        aria-controls="sidebar"
        aria-expanded={!collapsed}
        onClick={() => { setCollapsed((c) => !c); }}
      >
        {collapsed ? 'Expand menu' : 'Collapse menu'}
      </button>
      {children}
    </div>
  );
}
```
**Why it's right:** the layout stays a Server Component and only `SidebarShell` (toggle state) is client code; `Sidebar` and `NotificationsFeed` are passed as `ReactNode` slots, so they stay rendered on the server and out of the bundle; the slow feed is streamed with `<Suspense>`; the toggle is a `<button>` with `aria-expanded`.

### 3. ORM entities and secrets passed to a Client Component
```tsx
// features/customers/server/queries.ts
import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export type CustomerSummaryDto = {
  readonly id: string;
  readonly name: string;
  readonly creditBalanceCents: number;
  readonly invoices: ReadonlyArray<{ readonly id: string; readonly number: string }>;
};

export const getCustomerSummary = cache(async (id: string): Promise<CustomerSummaryDto | null> => {
  const user = await requireUser();
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId }, // authorization in the Data Access Layer
    select: { id: true, name: true, creditBalance: true, invoices: { select: { id: true, number: true } } },
  });
  if (!customer) return null;
  return {
    id: customer.id,
    name: customer.name,
    creditBalanceCents: customer.creditBalance.mul(100).toNumber(), // Decimal → number
    invoices: customer.invoices,
  };
});

// app/(dashboard)/customers/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getCustomerSummary } from '@/features/customers/server/queries';
import { CustomerCard } from '@/features/customers/components/customer-card';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerSummary(id);
  if (!customer) notFound();
  // the PDF is downloaded from an authenticated Route Handler: the billing key stays on the server
  return <CustomerCard customer={customer} />;
}
```
**Why it's right:** the `server-only` module prevents imports from the client; an explicit `select` and mapping to a plain DTO make the payload serializable and free of sensitive fields; the `tenantId` filter applies authorization next to the data; no secret crosses the server→client boundary.
