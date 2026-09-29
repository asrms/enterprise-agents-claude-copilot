# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Bypassing sanitization and leaking tokens
```typescript
@Component({
  selector: 'app-comment',
  template: `<div [innerHTML]="html"></div>`,
})
export class CommentComponent {
  @Input() set body(value: string) {
    this.html = this.sanitizer.bypassSecurityTrustHtml(value);  // stored XSS from user content
  }
  html!: SafeHtml;
  constructor(private sanitizer: DomSanitizer) {}
}

export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { Authorization: `Bearer ${localStorage.getItem('token')}` } }));
  // token readable by any injected script, and sent to every host, including third parties
```
**Why it's wrong:**
- User-controlled HTML is marked as trusted, so `<img src=x onerror=...>` executes.
- A long-lived token in `localStorage` is exposed to XSS and attached to requests for any origin.

## Best Practice (How to do it right)

### 1. Sanitized rich text and an origin-restricted interceptor
```typescript
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-comment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="comment" [innerHTML]="safeHtml()"></div>`,
})
export class CommentComponent {
  readonly body = input.required<string>();
  protected readonly safeHtml = computed(() =>
    DOMPurify.sanitize(this.body(), { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li'], ALLOWED_ATTR: ['href'] }),
  );   // Angular's sanitizer still runs on [innerHTML]
}

export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN');

export const apiCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const apiOrigin = inject(API_ORIGIN);
  const isApi = new URL(req.url, location.origin).origin === apiOrigin;
  return next(isApi ? req.clone({ withCredentials: true }) : req);   // BFF session cookie, API origin only
};
```
### 2. Strict CSP with Trusted Types (response header set by the server)
```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self' 'nonce-{RANDOM}';
  object-src 'none'; base-uri 'self'; frame-ancestors 'none';
  require-trusted-types-for 'script';
  trusted-types angular angular#bundler;
  report-to csp-endpoint
```
**Why it's right:**
- Only a small allow-list of tags survives sanitization, and no content is marked as trusted.
- Credentials are an `HttpOnly` session cookie handled by a BFF, sent only to the application's own API.
- CSP and Trusted Types turn remaining DOM XSS bugs into blocked, reported violations.
