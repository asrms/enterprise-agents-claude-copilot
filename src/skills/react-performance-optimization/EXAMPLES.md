# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Hero with `<img>`, external fonts, and a heavy chart in the initial bundle
```tsx
// app/(marketing)/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

type Point = { month: string; value: number };

export default function HomePage() {
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    void fetch('/api/stats').then(async (r) => { setPoints((await r.json()) as Point[]); });
  }, []);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
      <section className="hero">
        <img src="/images/hero.jpg" alt="Monitoring dashboard" />
        <h1>Monitor your metrics in real time</h1>
      </section>
      <section className="stats">
        <Line
          data={{
            labels: points.map((p) => p.month),
            datasets: [{ label: 'Active users', data: points.map((p) => p.value) }],
          }}
        />
      </section>
    </>
  );
}
```
**Why it's wrong:** the entire home page is client-side and `chart.js` enters the First Load JS even though the chart is below the fold; the `<img>` without dimensions causes CLS, downloads the original JPEG, and is not prioritized (slow LCP); the external font blocks rendering and causes layout shift; the chart data arrives only after hydration.

### 2. Filtering a list of thousands of items that blocks input (INP)
```tsx
// features/customers/components/customer-list.tsx
'use client';

import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { CustomerRow } from '@/features/customers/schemas';

export function CustomerList({ customers }: { customers: readonly CustomerRow[] }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(customers);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      // synchronous filter over 20,000 rows on every keystroke
      setFiltered(customers.filter((c) => c.name.toLowerCase().includes(e.target.value.toLowerCase())));
    },
    [customers],
  );

  const total = useMemo(() => filtered.length, [filtered]); // memo with no benefit at all

  return (
    <div>
      <input value={query} onChange={handleChange} aria-label="Search customer" />
      <p>{total} results</p>
      <ul>
        {filtered.map((c, index) => (
          <li key={index}>{c.name} — {c.email}</li>
        ))}
      </ul>
    </div>
  );
}
```
**Why it's wrong:** filtering and rendering 20,000 `<li>`s in the same urgent update as typing produces long tasks and an INP well over 200 ms; the derived state `filtered` duplicates data and can diverge from props; `key={index}` causes incorrect node reuse; `useMemo`/`useCallback` are used without measurement and do not fix the real bottleneck.

### 3. A single Context that re-renders the entire application
```tsx
// components/providers/app-provider.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CartItem, User } from '@/lib/types';

type Theme = 'light' | 'dark';
type AppContextValue = {
  user: User | null;
  theme: Theme;
  cart: CartItem[];
  setTheme: (theme: Theme) => void;
  addToCart: (item: CartItem) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [cart, setCart] = useState<CartItem[]>([]);

  // new object on every render: ALL consumers re-render
  const value = {
    user,
    theme,
    cart,
    setTheme,
    addToCart: (item: CartItem) => { setCart([...cart, item]); }, // closure over a stale cart
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
```
**Why it's wrong:** a single context mixes different domains, so adding an item to the cart re-renders the header, the theme toggle, and every other consumer; the `value` is recreated on every render; `addToCart` closes over a copy of `cart` that becomes stale with rapid updates.

## Best Practice (How to do it right)

### 1. Hero with `<img>`, external fonts, and a heavy chart in the initial bundle
```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

// app/(marketing)/page.tsx — Server Component
import Image from 'next/image';
import heroImage from '@/public/images/hero.jpg';
import { getMonthlyStats } from '@/features/stats/server/queries';
import { StatsChart } from '@/features/stats/components/stats-chart';

export default async function HomePage() {
  const points = await getMonthlyStats();
  return (
    <>
      <section className="hero">
        {/* static import: width, height, and blur computed at build time (zero CLS) */}
        {/* priority on the LCP image; in Next 16 use `preload` (priority is deprecated) */}
        <Image src={heroImage} alt="Monitoring dashboard" priority placeholder="blur" sizes="(max-width: 768px) 100vw, 1200px" />
        <h1>Monitor your metrics in real time</h1>
      </section>
      <StatsChart points={points} />
    </>
  );
}

// features/stats/components/stats-chart.tsx
'use client';

import dynamic from 'next/dynamic';
import type { Point } from '@/features/stats/schemas';
import { ChartSkeleton } from './chart-skeleton';

// chart.js downloaded in a separate chunk, outside the home page's First Load JS
const LineChart = dynamic(() => import('./line-chart').then((m) => m.LineChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={320} />,
});

export function StatsChart({ points }: { points: readonly Point[] }) {
  return <LineChart points={points} />;
}
```
**Why it's right:** the page is a Server Component that receives the data already on the server; `next/image` with a static import, `sizes`, and `priority` optimizes the LCP's format, size, and priority without CLS; `next/font` self-hosts the font with no blocking requests; the chart is a chunk loaded with `next/dynamic` and a fixed-height skeleton.

### 2. Filtering a list of thousands of items that blocks input (INP)
```tsx
// features/customers/components/customer-list.tsx
'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CustomerRow } from '@/features/customers/schemas';

const ROW_HEIGHT = 48;

export function CustomerList({ customers }: { customers: readonly CustomerRow[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // the input stays responsive, the filter follows
  const needle = deferredQuery.trim().toLowerCase();

  // memo justified by the Profiler (filter over 20k rows > 16 ms); unnecessary with React Compiler
  const filtered = useMemo(
    () => (needle === '' ? customers : customers.filter((c) => c.searchKey.includes(needle))),
    [customers, needle],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div>
      <label htmlFor="customer-search">Search customer</label>
      <input id="customer-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); }} />
      <p role="status">{filtered.length} results</p>
      <div ref={scrollRef} style={{ height: 480, overflowY: 'auto', opacity: query !== deferredQuery ? 0.6 : 1 }}>
        <ul style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((row) => {
            const customer = filtered[row.index];
            if (!customer) return null; // noUncheckedIndexedAccess
            return (
              <li
                key={customer.id}
                style={{ position: 'absolute', top: 0, width: '100%', height: ROW_HEIGHT, transform: `translateY(${String(row.start)}px)` }}
              >
                {customer.name} — {customer.email}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```
**Why it's right:** `useDeferredValue` separates typing (urgent) from filtering (deferrable) and keeps INP low; the virtualized list renders only the visible rows plus the `overscan`; the result is computed during render and memoized only because the measurement justifies it; keys are stable IDs and `searchKey` is normalized upstream on the server.

### 3. A single Context that re-renders the entire application
```tsx
// features/cart/components/cart-provider.tsx
'use client';

import { createContext, use, useMemo, useReducer, type ReactNode } from 'react';
import type { CartItem } from '@/features/cart/schemas';

type CartAction = { type: 'add'; item: CartItem } | { type: 'remove'; sku: string };
type CartActions = { add: (item: CartItem) => void; remove: (sku: string) => void };

function cartReducer(state: readonly CartItem[], action: CartAction): readonly CartItem[] {
  switch (action.type) {
    case 'add':
      return [...state, action.item];
    case 'remove':
      return state.filter((i) => i.sku !== action.sku);
  }
}

// state and actions in separate contexts: components that use only the actions do not re-render
const CartStateContext = createContext<readonly CartItem[] | null>(null);
const CartActionsContext = createContext<CartActions | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  // dispatch is stable: the actions object is created only once
  const actions = useMemo<CartActions>(
    () => ({
      add: (item) => { dispatch({ type: 'add', item }); },
      remove: (sku) => { dispatch({ type: 'remove', sku }); },
    }),
    [],
  );
  return (
    <CartActionsContext value={actions}>
      <CartStateContext value={items}>{children}</CartStateContext>
    </CartActionsContext>
  );
}

export function useCartItems(): readonly CartItem[] {
  const items = use(CartStateContext);
  if (items === null) throw new Error('useCartItems must be used inside <CartProvider>');
  return items;
}

export function useCartActions(): CartActions {
  const actions = use(CartActionsContext);
  if (actions === null) throw new Error('useCartActions must be used inside <CartProvider>');
  return actions;
}
```
**Why it's right:** the cart has a dedicated provider, separate from theme and session; state and stable actions live in distinct contexts, so the "Add" buttons do not re-render when the list changes; `useReducer` eliminates stale closures; the React 19 syntax `<Context value>` and `use(Context)` keeps the code concise and type-safe.
