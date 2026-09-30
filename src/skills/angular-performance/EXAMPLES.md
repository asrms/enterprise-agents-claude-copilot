# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Expensive template calls, untracked lists, eager heavy widgets
```typescript
@Component({
  selector: 'app-dashboard',
  imports: [SalesChartComponent, NgFor],
  template: `
    <img src="/assets/hero.png">                                  <!-- no size: layout shift -->
    <app-sales-chart [data]="buildSeries(orders)" />              <!-- recomputed on every check -->
    <tr *ngFor="let o of orders">{{ o.number }}</tr>              <!-- no tracking: full re-render -->
  `,
})
export class DashboardComponent {
  orders: Order[] = [];
  buildSeries(orders: Order[]) { return groupByDay(orders); }     // O(n) work per change detection
}
```
**Why it's wrong:**
- Default change detection plus method calls in the template re-run heavy work on every cycle.
- The chart library ships in the initial bundle even though it is below the fold; the hero image causes layout shift.

## Best Practice (How to do it right)

### 1. OnPush, computed series, deferred chart, optimized image
```typescript
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, SalesChartComponent, OrderRowComponent],
  template: `
    <img ngSrc="hero.webp" width="1200" height="480" priority alt="Quarterly sales overview" />

    @defer (on viewport; prefetch on idle) {
      <app-sales-chart [data]="series()" />
    } @placeholder (minimum 200ms) {
      <div class="chart-skeleton" aria-hidden="true"></div>
    } @loading {
      <app-spinner />
    }

    @for (o of orders(); track o.id) {
      <app-order-row [order]="o" />
    }
  `,
})
export class DashboardComponent {
  private readonly store = inject(DashboardStore);
  protected readonly orders = this.store.orders;
  protected readonly series = computed(() => groupByDay(this.orders()));
}
```
`angular.json` (excerpt):
```json
"budgets": [
  { "type": "initial", "maximumWarning": "400kB", "maximumError": "550kB" },
  { "type": "anyComponentStyle", "maximumWarning": "6kB", "maximumError": "10kB" }
]
```
**Why it's right:**
- The series is memoized with `computed` and only recalculated when orders change; the list is tracked by id.
- The chart and its library load only when scrolled into view; the LCP image is prioritized with fixed dimensions.
- Bundle budgets make regressions fail the build.
