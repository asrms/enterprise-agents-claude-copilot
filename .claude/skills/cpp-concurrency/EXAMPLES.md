# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Data race, manual locking, and a lost wakeup
```cpp
std::queue<Job> jobs;
std::mutex m;
std::condition_variable cv;
bool stopping = false;                           // written without the mutex

void worker() {
    while (!stopping) {
        m.lock();
        if (jobs.empty()) cv.wait(*new std::unique_lock<std::mutex>(m, std::adopt_lock));  // leak, no predicate
        Job j = jobs.front(); jobs.pop();
        process(j);                              // long work while holding the lock
        m.unlock();                              // skipped if process() throws
    }
}

std::thread(worker).detach();                    // outlives globals at shutdown
```
**Why it's wrong:**
- `stopping` is raced, the wait has no predicate (spurious and lost wakeups), and manual locking leaks on exceptions.
- Work runs under the lock, serializing all workers, and detached threads cannot be shut down safely.

## Best Practice (How to do it right)

### 1. Bounded queue with RAII locks, predicates, and cooperative cancellation
```cpp
template <typename T>
class BoundedQueue {
public:
    explicit BoundedQueue(std::size_t capacity) : capacity_(capacity) {}

    bool push(T value, std::stop_token st) {
        std::unique_lock lock(mutex_);
        if (!not_full_.wait(lock, st, [&] { return items_.size() < capacity_; })) return false;  // stop requested
        items_.push(std::move(value));
        not_empty_.notify_one();
        return true;
    }

    std::optional<T> pop(std::stop_token st) {
        std::unique_lock lock(mutex_);
        if (!not_empty_.wait(lock, st, [&] { return !items_.empty(); })) return std::nullopt;
        T value = std::move(items_.front());
        items_.pop();
        not_full_.notify_one();
        return value;
    }

private:
    std::mutex mutex_;                                   // guards items_
    std::condition_variable_any not_empty_, not_full_;
    std::queue<T> items_;
    std::size_t capacity_;
};

class WorkerPool {
public:
    WorkerPool(std::size_t n, BoundedQueue<Job>& queue) {
        for (std::size_t i = 0; i < n; ++i) {
            workers_.emplace_back([&queue](std::stop_token st) {
                while (auto job = queue.pop(st)) {
                    try { process(*job); }                 // outside the lock
                    catch (const std::exception& e) { log_error(e.what()); }
                }
            });
        }
    }
    // ~WorkerPool: jthreads request stop and join automatically
private:
    std::vector<std::jthread> workers_;
};
```
**Why it's right:**
- All shared state is guarded by one mutex with RAII locks, waits use predicates and stop tokens, and the queue applies backpressure.
- Work runs outside the lock, exceptions are contained per job, and `std::jthread` guarantees orderly shutdown.
