# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual lifetime management and dangling views
```cpp
Config* load_config(const char* path) {
    FILE* f = fopen(path, "r");
    Config* cfg = new Config();
    if (!parse(f, cfg)) {
        return nullptr;                           // leaks cfg and the FILE handle
    }
    fclose(f);
    return cfg;                                   // caller must remember to delete
}

std::string_view customer_name(const Order& o) {
    std::string full = o.first_name + " " + o.last_name;
    return full;                                  // view into a destroyed string: dangling
}

void add_all(std::vector<Item>& items, const Item& first) {
    Item& ref = items.front();
    items.push_back(first);                       // may reallocate: ref now dangles
    ref.quantity += 1;                            // undefined behavior
}
```
**Why it's wrong:**
- Early returns leak memory and handles, and ownership of the returned pointer is unclear.
- Views and references outlive the objects they point to, causing undefined behavior.

## Best Practice (How to do it right)

### 1. RAII wrappers, unique ownership, and safe lifetimes
```cpp
struct FileCloser { void operator()(std::FILE* f) const noexcept { if (f) std::fclose(f); } };
using FilePtr = std::unique_ptr<std::FILE, FileCloser>;

[[nodiscard]] std::expected<std::unique_ptr<Config>, ConfigError> load_config(const std::filesystem::path& path) {
    FilePtr file{std::fopen(path.c_str(), "r")};
    if (!file) return std::unexpected(ConfigError::CannotOpen);

    auto cfg = std::make_unique<Config>();
    if (!parse(file.get(), *cfg)) return std::unexpected(ConfigError::Invalid);   // file closed automatically
    return cfg;                                                                     // ownership transferred
}

[[nodiscard]] std::string customer_name(const Order& o) {       // returns an owning string
    return o.first_name + " " + o.last_name;
}

void add_and_bump_first(std::vector<Item>& items, const Item& extra) {
    items.push_back(extra);
    items.front().quantity += 1;                                 // re-fetch after the modification
}
```
```cmake
# Debug and CI builds: sanitizers and hardened standard library
target_compile_options(orders PRIVATE $<$<CONFIG:Debug>:-fsanitize=address,undefined -fno-omit-frame-pointer>)
target_link_options(orders PRIVATE $<$<CONFIG:Debug>:-fsanitize=address,undefined>)
target_compile_definitions(orders PRIVATE $<$<CONFIG:Debug>:_GLIBCXX_ASSERTIONS>)
```
**Why it's right:**
- Resources are released on every path, and ownership is explicit in the return type.
- Functions return owning values instead of dangling views, containers are re-accessed after modification, and sanitizers catch remaining mistakes.
