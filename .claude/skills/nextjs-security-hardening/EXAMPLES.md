# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Server Action without authentication, authorization, and validation
```ts
// features/invoices/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

// "only the administrator can see the button anyway"
export async function updateInvoiceStatus(invoiceId: string, status: string, approvedBy: string) {
  try {
    const invoice = await db.invoice.update({
      where: { id: invoiceId },
      data: { status: status as 'draft' | 'approved' | 'paid', approvedBy },
    });
    revalidatePath('/invoices');
    // full record returned to the client
    return { ok: true, invoice };
  } catch (error) {
    // Prisma/SQL details sent to the browser
    return { ok: false, error: String(error) };
  }
}
```
**Why it's wrong:** the action is a public POST endpoint and anyone who knows the action ID can approve any invoice of any tenant (IDOR); `approvedBy` comes from the client and can be forged; `status` is not validated and the cast hides arbitrary values; the full record and raw errors expose internal data.

### 2. Permissive CSP and missing security headers
```tsx
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // poweredByHeader not set: every response exposes "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // wildcard + unsafe-inline + unsafe-eval: the policy blocks no XSS at all
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
          },
          // no HSTS, nosniff, Referrer-Policy, or clickjacking protection
        ],
      },
    ];
  },
};

export default nextConfig;

// app/layout.tsx
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* inline script without a nonce: works only thanks to 'unsafe-inline' */}
        <script dangerouslySetInnerHTML={{ __html: 'window.dataLayer = window.dataLayer || [];' }} />
        <script src="https://cdn.analytics.example.com/tag.js" async />
      </head>
      <body>{children}</body>
    </html>
  );
}
```
**Why it's wrong:** `'unsafe-inline'` and `'unsafe-eval'` with `default-src *` nullify the CSP's protection against XSS; HSTS, `nosniff`, `Referrer-Policy`, and `frame-ancestors`/`X-Frame-Options` (clickjacking) are missing; `X-Powered-By` reveals the stack; inline scripts are not tied to a nonce.

### 3. Unvalidated post-login redirect and CMS HTML
```tsx
// features/auth/actions.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate } from '@/features/auth/server/authenticate';

export async function login(formData: FormData) {
  const token = await authenticate(String(formData.get('email')), String(formData.get('password')));
  // cookie readable by JavaScript, without secure or sameSite
  (await cookies()).set('token', token);
  // ?next=https://evil.example/login → phishing with a trusted domain
  redirect(String(formData.get('next') ?? '/'));
}

// app/(marketing)/blog/[slug]/page.tsx
import { getPost } from '@/features/blog/server/queries';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  // CMS HTML rendered as is: <img src=x onerror=...> executes script
  return <article dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />;
}
```
**Why it's wrong:** the unvalidated `next` parameter creates an open redirect exploitable for phishing; the session cookie is accessible to JavaScript and sent cross-site too; email and password are not validated; unsanitized external HTML allows stored XSS.

## Best Practice (How to do it right)

### 1. Server Action without authentication, authorization, and validation
```ts
// features/invoices/actions.ts
'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { invoiceRepository } from '@/features/invoices/server/invoice-repository';

const UpdateInvoiceStatusSchema = z.object({
  invoiceId: z.uuid(),
  status: z.enum(['approved', 'rejected']),
});

export type UpdateInvoiceStatusResult =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; code: 'UNAUTHENTICATED' | 'VALIDATION_ERROR' | 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL' };

export async function updateInvoiceStatus(
  _prev: UpdateInvoiceStatusResult,
  formData: FormData,
): Promise<UpdateInvoiceStatusResult> {
  // 1. authentication
  const session = await getSession();
  if (!session) return { status: 'error', code: 'UNAUTHENTICATED' };

  // 2. input validation
  const parsed = UpdateInvoiceStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', code: 'VALIDATION_ERROR' };

  // 3. authorization on the resource: tenant and permissions from the session, never from the client
  const invoice = await invoiceRepository.findById(parsed.data.invoiceId);
  if (!invoice || invoice.tenantId !== session.tenantId) return { status: 'error', code: 'NOT_FOUND' };
  if (!session.permissions.includes('invoice:approve')) return { status: 'error', code: 'FORBIDDEN' };

  // 4. mutation
  try {
    await invoiceRepository.updateStatus(invoice.id, parsed.data.status, session.userId);
  } catch (error) {
    logger.error({ err: error, invoiceId: invoice.id }, 'updateInvoiceStatus failed');
    return { status: 'error', code: 'INTERNAL' };
  }
  revalidateTag(`invoices:${session.tenantId}`);
  return { status: 'success' };
}
```
**Why it's right:** authentication, Zod validation, and authorization happen inside the action, which is the only reliable place; the approver is taken from the session and the tenant is verified on the resource (no IDOR, 404 for other tenants' resources); the client receives only typed domain codes while the details go to the logs.

### 2. Permissive CSP and missing security headers
```ts
// proxy.ts — Next 16 (in Next 15: middleware.ts with `export function middleware`)
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce); // read in the layout with (await headers()).get('x-nonce')
  requestHeaders.set('Content-Security-Policy', csp); // Next.js applies the nonce to its own scripts

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
    },
  ],
};

// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
```
**Why it's right:** a random per-request nonce with `'strict-dynamic'` blocks injected scripts without resorting to `'unsafe-inline'`; the policy in the request header lets Next.js apply the nonce to its own scripts and the layout passes it to third-party `<Script nonce>`s; the static headers cover HSTS, MIME sniffing, referrer, and clickjacking, and `poweredByHeader: false` removes the fingerprint.

### 3. Unvalidated post-login redirect and CMS HTML
```tsx
// lib/safe-redirect.ts
import 'server-only';
import { env } from '@/lib/env';

export function toSafeRedirectPath(candidate: unknown, fallback = '/dashboard'): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }
  const origin = new URL(env.APP_URL).origin;
  const target = new URL(candidate, origin);
  return target.origin === origin ? `${target.pathname}${target.search}` : fallback;
}

// features/auth/actions.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { authenticate } from '@/features/auth/server/authenticate';
import { toSafeRedirectPath } from '@/lib/safe-redirect';

const LoginSchema = z.object({ email: z.email(), password: z.string().min(1).max(256) });
export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'Invalid credentials' };
  const session = await authenticate(parsed.data.email, parsed.data.password);
  if (!session) return { error: 'Invalid credentials' }; // neutral message
  (await cookies()).set('__Host-session', session.token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
  });
  redirect(toSafeRedirectPath(formData.get('next'))); // outside try/catch
}

// app/(marketing)/blog/[slug]/page.tsx
import DOMPurify from 'isomorphic-dompurify';
import { notFound } from 'next/navigation';
import { getPost } from '@/features/blog/server/queries';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const safeHtml = DOMPurify.sanitize(post.bodyHtml, { USE_PROFILES: { html: true } });
  return <article dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
```
**Why it's right:** the redirect accepts only same-origin relative paths, so an open redirect is impossible; the `__Host-` cookie is `httpOnly`, `secure`, and `sameSite` with an explicit expiry; the input is validated with Zod and the messages do not reveal which credential is wrong; the CMS HTML is sanitized with DOMPurify on the server before rendering.
