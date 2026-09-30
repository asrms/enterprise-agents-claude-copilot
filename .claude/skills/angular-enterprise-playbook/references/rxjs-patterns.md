# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Nested subscriptions, race conditions, leaks
```typescript
export class SearchComponent implements OnInit {
  results: Product[] = [];
  constructor(private route: ActivatedRoute, private api: ProductApi) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {            // never unsubscribed
      this.api.search(params.get('q') ?? '').subscribe(r => {  // nested subscribe
        this.results = r;                                      // an older, slower response can overwrite a newer one
      });
    });
  }
}
```
**Why it's wrong:**
- Every query change starts a request that is never cancelled; out-of-order responses show stale results.
- Subscriptions outlive the component, and an error in `search` kills the inner stream without feedback.

## Best Practice (How to do it right)

### 1. One declarative pipeline with cancellation, error handling, and interop
```typescript
@Component({
  selector: 'app-product-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (vm().state) {
      @case ('loading') { <app-spinner /> }
      @case ('error') { <p role="alert">Search failed. Try again.</p> }
      @case ('done') {
        @for (p of vm().items; track p.id) { <app-product-card [product]="p" /> }
      }
    }
  `,
})
export class ProductSearchComponent {
  private readonly api = inject(ProductApi);
  private readonly query$ = inject(ActivatedRoute).queryParamMap.pipe(
    map(p => (p.get('q') ?? '').trim()),
    debounceTime(300),
    distinctUntilChanged(),
    filter(q => q.length >= 2),
  );

  protected readonly vm = toSignal(
    this.query$.pipe(
      switchMap(q =>
        this.api.search(q).pipe(
          retry({ count: 2, delay: (_, attempt) => timer(attempt * 500) }),
          map(items => ({ state: 'done' as const, items })),
          catchError(() => of({ state: 'error' as const, items: [] })),
          startWith({ state: 'loading' as const, items: [] }),
        ),
      ),
    ),
    { initialValue: { state: 'done' as const, items: [] as Product[] } },
  );
}
```
### 2. Marble test for latest-wins behavior
```typescript
it('cancels the previous search when the query changes', () => {
  new TestScheduler((a, e) => expect(a).toEqual(e)).run(({ cold, expectObservable }) => {
    const queries = cold('a--b|', { a: 'sh', b: 'shoe' });
    const search = (q: string) => cold('---r|', { r: q });
    expectObservable(queries.pipe(switchMap(search))).toBe('------r|', { r: 'shoe' });
  });
});
```
**Why it's right:**
- `switchMap` cancels outdated requests, errors are handled per request, and the stream survives failures.
- `toSignal` manages the subscription lifecycle; the template renders explicit loading, error, and result states.
- The marble test proves the cancellation semantics deterministically.
