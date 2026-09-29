# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Eager NgModule, type-based folders, fat component
```text
src/app/
  components/   services/   models/   pipes/
  app.module.ts          # declares 60 components, imports every feature eagerly
```
```typescript
@Component({
  selector: 'app-orders',
  template: `
    <div *ngFor="let o of orders">{{ formatTotal(o) }}</div>   <!-- no trackBy, method call per check -->
  `,
})
export class OrdersComponent implements OnInit {
  orders: any[] = [];
  constructor(private http: HttpClient, private router: Router) {}
  ngOnInit() {
    this.http.get<any[]>('/api/orders').subscribe(r => (this.orders = r));  // never unsubscribed
  }
  formatTotal(o: any) { return o.total.toFixed(2) + ' EUR'; }
}
```
**Why it's wrong:**
- The whole application is downloaded up front; folders by type scatter each feature across the tree.
- The component mixes data access, formatting, and rendering, uses `any`, default change detection, and a manual subscription.

## Best Practice (How to do it right)

### 1. Standalone bootstrap, lazy feature routes, container and presentational components
`app.config.ts`:
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, problemDetailsInterceptor])),
  ],
};
```
`app.routes.ts`:
```typescript
export const routes: Routes = [
  { path: 'orders', canActivate: [authGuard], loadChildren: () => import('./features/orders/orders.routes') },
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
];
```
`features/orders/orders.routes.ts`:
```typescript
export default [
  {
    path: '',
    providers: [OrdersStore],
    children: [
      { path: '', loadComponent: () => import('./pages/order-list.page') },
      { path: ':orderId', loadComponent: () => import('./pages/order-detail.page') },
    ],
  },
] satisfies Routes;
```
`features/orders/ui/order-row.component.ts`:
```typescript
@Component({
  selector: 'app-order-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  template: `
    <span>{{ order().number }}</span>
    <span>{{ order().total | currency: order().currency }}</span>
    <button type="button" (click)="cancel.emit(order().id)">Cancel</button>
  `,
})
export class OrderRowComponent {
  readonly order = input.required<OrderSummary>();
  readonly cancel = output<string>();
}
```
`features/orders/pages/order-list.page.ts`:
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrderRowComponent],
  template: `
    @for (order of store.orders(); track order.id) {
      <app-order-row [order]="order" (cancel)="store.cancel($event)" />
    } @empty {
      <p>No orders yet.</p>
    }
  `,
})
export default class OrderListPage {
  protected readonly store = inject(OrdersStore);
}
```
**Why it's right:**
- Features are lazy-loaded with their own scoped providers; the root only composes them.
- The page (container) talks to the store; the row component is presentational, typed, and OnPush.
- Built-in control flow with `track` renders efficiently, and formatting uses a pure pipe.
