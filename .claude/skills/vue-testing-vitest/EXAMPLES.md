# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Testing internals with mocked fetch and sleeps
```typescript
it('loads orders', async () => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => [{ id: 1 }] }) as any
  const wrapper = shallowMount(OrderList)                 // children stubbed away
  await new Promise(r => setTimeout(r, 500))              // real sleep
  expect((wrapper.vm as any).orders.length).toBe(1)       // private state
})
```
**Why it's wrong:**
- It asserts internal state instead of what is rendered, so it passes even if the template is broken.
- The fake `fetch` does not behave like a real response (`ok`, status), and the fixed sleep is slow and flaky.

## Best Practice (How to do it right)

### 1. Behavior test with Testing Library and MSW
```typescript
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import OrderList from './OrderList.vue'

const server = setupServer(
  http.get('/api/orders', () => HttpResponse.json([{ id: 'o-1', number: 'SO-1001', status: 'PENDING' }])),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('shows orders and emits the selected one', async () => {
  const { emitted } = render(OrderList)

  const item = await screen.findByRole('button', { name: 'SO-1001' })
  await userEvent.click(item)

  expect(emitted()['select']?.[0]).toEqual(['o-1'])
})

it('shows an error when loading fails', async () => {
  server.use(http.get('/api/orders', () => new HttpResponse(null, { status: 500 })))
  render(OrderList)
  expect(await screen.findByRole('alert')).toHaveTextContent('Orders could not be loaded')
})
```
### 2. Composable with fake timers
```typescript
it('debounces the search term', async () => {
  vi.useFakeTimers()
  const term = ref('')
  const scope = effectScope()
  const { debounced } = scope.run(() => useDebouncedRef(term, 300))!

  term.value = 'sho'
  term.value = 'shoe'
  await vi.advanceTimersByTimeAsync(299)
  expect(debounced.value).toBe('')
  await vi.advanceTimersByTimeAsync(1)
  expect(debounced.value).toBe('shoe')

  scope.stop()
  vi.useRealTimers()
})
```
**Why it's right:**
- Tests interact like users and assert visible output and emitted events; HTTP is mocked at the network level.
- Failure paths are covered, and time is controlled deterministically.
