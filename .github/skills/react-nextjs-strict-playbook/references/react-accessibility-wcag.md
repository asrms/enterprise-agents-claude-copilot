# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Clickable product card with `div onClick` and an unnamed icon button
```tsx
// features/catalog/components/product-card.tsx
'use client';

import { useRouter } from 'next/navigation';
import { HeartIcon } from '@/components/icons';
import type { ProductCardDto } from '@/features/catalog/schemas';

type Props = { product: ProductCardDto; onToggleFavorite: (id: string) => void };

export function ProductCard({ product, onToggleFavorite }: Props) {
  const router = useRouter();
  return (
    <div className="card" onClick={() => { router.push(`/products/${product.slug}`); }}>
      <img src={product.imageUrl} />
      <div className="card-title">{product.name}</div>
      {/* #9e9e9e on white: 2.7:1 contrast */}
      <span className="price" style={{ color: '#9e9e9e' }}>{product.priceLabel}</span>
      <div
        className="icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(product.id);
        }}
      >
        <HeartIcon filled={product.isFavorite} />
      </div>
    </div>
  );
}
```
**Why it's wrong:** the card and the favorite "button" are `div`s that cannot be focused or activated from the keyboard and have no role; navigation is not a link (no opening in a new tab, no "link" announcement); the image has no `alt`, the icon button has no accessible name or state, and the price has 2.7:1 contrast, below the 4.5:1 threshold.

### 2. Custom modal without focus management
```tsx
// components/ui/confirm-modal.tsx
'use client';

type Props = { open: boolean; title: string; message: string; onConfirm: () => void; onClose: () => void };

export function ConfirmModal({ open, title, message, onConfirm, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => { e.stopPropagation(); }}>
        <div className="close" onClick={onClose}>✕</div>
        <div className="modal-title">{title}</div>
        <p>{message}</p>
        <div className="modal-actions">
          <span className="link" onClick={onClose}>Cancel</span>
          <div className="btn-danger" onClick={onConfirm}>Delete</div>
        </div>
      </div>
    </div>
  );
}
```
**Why it's wrong:** dialog semantics are missing (`role="dialog"`, `aria-modal`, `aria-labelledby`), so the screen reader does not know a modal has opened; focus stays on the trigger beneath the overlay and `Tab` keeps navigating the underlying page; `Escape` does not close it and on close focus does not return to the trigger; the controls are `div`s/`span`s unusable from the keyboard.

### 3. Form with placeholders instead of labels and unannounced errors
```tsx
// features/account/components/signup-form.tsx
'use client';

import { useActionState } from 'react';
import { signup, type SignupState } from '@/features/account/actions';
import { Spinner } from '@/components/ui/spinner';

const initialState: SignupState = { status: 'idle', fieldErrors: {}, message: null };

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialState);
  return (
    <form action={formAction} noValidate>
      <input name="email" placeholder="Email" className={state.fieldErrors.email ? 'input input--error' : 'input'} />
      <input name="password" type="password" placeholder="Password (min. 12 characters)" />
      {state.fieldErrors.password && <small style={{ color: '#ff6b6b' }}>{state.fieldErrors.password}</small>}
      <input type="checkbox" name="terms" /> I accept the terms of service
      <button disabled={isPending} style={{ outline: 'none' }}>
        {isPending ? <Spinner /> : 'Sign up'}
      </button>
      {/* live region mounted together with the message: often not announced */}
      {state.message && <div className="toast fade-in">{state.message}</div>}
    </form>
  );
}
```
**Why it's wrong:** placeholders disappear while typing and are not labels; the email error is communicated only by the border color (1.4.1) and the password error is not linked to the field; the checkbox has no associated label; `outline: none` hides focus, the spinner has no accessible name, and the toast mounted together with the message is not announced; `autoComplete` and moving focus to the error are missing.

## Best Practice (How to do it right)

### 1. Clickable product card with `div onClick` and an unnamed icon button
```tsx
// features/catalog/components/product-card.tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ProductCardDto } from '@/features/catalog/schemas';
import { FavoriteButton } from './favorite-button';

export function ProductCard({ product }: { product: ProductCardDto }) {
  return (
    <article className="card">
      <Image src={product.imageUrl} alt={product.imageAlt} width={320} height={240} sizes="(max-width: 640px) 100vw, 320px" />
      <h3 className="card-title">
        {/* link stretched over the whole card via CSS (::after): a single tab stop */}
        <Link href={`/products/${product.slug}`} className="card-link">{product.name}</Link>
      </h3>
      {/* --text-muted token #595959 on white: 7:1 contrast */}
      <p className="price">{product.priceLabel}</p>
      <FavoriteButton productId={product.id} productName={product.name} initialFavorite={product.isFavorite} />
    </article>
  );
}

// features/catalog/components/favorite-button.tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { HeartIcon } from '@/components/icons';
import { toggleFavorite } from '@/features/catalog/actions';

type Props = { productId: string; productName: string; initialFavorite: boolean };

export function FavoriteButton({ productId, productName, initialFavorite }: Props) {
  const [isFavorite, setOptimisticFavorite] = useOptimistic(initialFavorite);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="icon-btn" // min 24×24 CSS px (WCAG 2.5.8)
      aria-pressed={isFavorite}
      aria-label={`Save ${productName} to favorites`}
      onClick={() => {
        startTransition(async () => {
          setOptimisticFavorite(!isFavorite);
          await toggleFavorite(productId);
        });
      }}
    >
      <HeartIcon aria-hidden="true" filled={isFavorite} />
    </button>
  );
}
```
**Why it's right:** navigation uses a real `<Link>` inside a heading and the action a `<button>`, both natively focusable and keyboard-activatable; the image has a descriptive `alt`; the icon button has a stable accessible name and communicates state with `aria-pressed`, with the SVG hidden from screen readers; the text uses a token with compliant contrast.

### 2. Custom modal without focus management
```tsx
// components/ui/confirm-dialog.tsx
'use client';

import { useEffect, useId, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // showModal(): top layer, focus trap, underlying page inert, native Escape
    if (open && !dialog.open) dialog.showModal();
    // close(): the browser restores focus to the element that opened the dialog
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose} // closing with Escape or with dialog.close()
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{message}</p>
      <div className="dialog-actions">
        {/* first focusable element: showModal() moves focus to the least destructive action */}
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
```
**Why it's right:** the native `<dialog>` with `showModal()` provides role, focus trap, inert underlying content, closing with `Escape`, and focus restoration with no custom code; title and description are linked with `aria-labelledby`/`aria-describedby`; initial focus lands on "Cancel" and all controls are real `<button>`s.

### 3. Form with placeholders instead of labels and unannounced errors
```tsx
// features/account/components/signup-form.tsx
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { signup, type SignupState } from '@/features/account/actions';

const initialState: SignupState = { status: 'idle', fieldErrors: {}, message: null };

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { email: emailError, password: passwordError } = state.fieldErrors;

  useEffect(() => {
    // after a failed submit, focus moves to the first invalid field
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate>
      <label htmlFor="signup-email">Email</label>
      <input id="signup-email" name="email" type="email" autoComplete="email" required
        aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? 'signup-email-error' : undefined} />
      {emailError && <p id="signup-email-error" className="field-error">Error: {emailError}</p>}

      <label htmlFor="signup-password">Password</label>
      <input id="signup-password" name="password" type="password" autoComplete="new-password" required
        aria-invalid={passwordError ? true : undefined}
        aria-describedby={passwordError ? 'signup-password-hint signup-password-error' : 'signup-password-hint'} />
      <p id="signup-password-hint">At least 12 characters.</p>
      {passwordError && <p id="signup-password-error" className="field-error">Error: {passwordError}</p>}

      <input id="signup-terms" name="terms" type="checkbox" required />
      <label htmlFor="signup-terms">I accept the terms of service</label>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Signing up…' : 'Sign up'}
      </button>
      {/* live region always mounted: content changes are announced */}
      <p role="status">{state.message ?? ''}</p>
    </form>
  );
}
```
**Why it's right:** every field has an associated `<label>` and the correct `autoComplete`; errors are textual, marked with `aria-invalid`, and linked with `aria-describedby` together with the hint; after a failed submit focus moves to the first invalid field; the `role="status"` live region already exists in the DOM and announces the result, while the button exposes a textual pending state and keeps the browser's visible focus.
