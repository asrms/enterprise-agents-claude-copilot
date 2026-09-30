# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Implementation-detail test with silenced errors
```typescript
describe('OrderListPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderListPage],
      schemas: [NO_ERRORS_SCHEMA],                     // hides broken bindings
    });
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OrderListPage);
    expect(fixture.componentInstance).toBeTruthy();  // proves nothing
  });

  it('loads orders', () => {
    const fixture = TestBed.createComponent(OrderListPage);
    const spy = vi.spyOn(fixture.componentInstance as any, 'loadOrders');
    fixture.componentInstance.ngOnInit();
    expect(spy).toHaveBeenCalled();                   // tests a private method, not behavior
  });
});
```
**Why it's wrong:**
- Template errors are suppressed, and assertions target internals instead of what the user sees.
- The tests pass even if the page renders nothing.

## Best Practice (How to do it right)

### 1. Behavior-driven component test with Testing Library and HTTP testing
```typescript
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

describe('OrderListPage', () => {
  it('shows orders and cancels one', async () => {
    await render(OrderListPage, {
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), OrdersStore],
    });
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/orders?status=ALL&page=1').flush({
      items: [{ id: 'o-1', number: 'SO-1001', total: 42.5, currency: 'EUR' }],
    });

    expect(await screen.findByText('SO-1001')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const cancel = http.expectOne({ method: 'POST', url: '/api/orders/o-1/cancel' });
    cancel.flush(null);

    http.verify();
  });
});
```
### 2. Signal inputs set through the component reference
```typescript
it('renders the formatted total', async () => {
  const fixture = TestBed.createComponent(OrderRowComponent);
  fixture.componentRef.setInput('order', { id: 'o-1', number: 'SO-1001', total: 42.5, currency: 'EUR' });
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('€42.50');
});
```
**Why it's right:**
- The test drives the UI like a user and asserts visible output and the exact HTTP calls made.
- `HttpTestingController.verify()` fails on unexpected requests; signal inputs are set through the supported API.
