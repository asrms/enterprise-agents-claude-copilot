# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Importing a YAML pipeline from a user-supplied URL (Python/FastAPI)
```python
from urllib.parse import urlparse

import requests
import yaml
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
BLOCKED = ("localhost", "127.0.0.1", "169.254.169.254")


class ImportRequest(BaseModel):
    url: str


@app.post("/api/pipelines/import")
def import_pipeline(req: ImportRequest):
    host = urlparse(req.url).hostname or ""
    if host in BLOCKED:  # string blocklist
        raise HTTPException(400, "Host not allowed")
    resp = requests.get(req.url, timeout=30)  # follows redirects, any host and port
    try:
        config = yaml.load(resp.text, Loader=yaml.Loader)  # builds arbitrary Python objects
    except yaml.YAMLError as exc:
        # the remote server's response is reflected to the caller
        raise HTTPException(400, f"Invalid YAML: {exc}\n{resp.text[:2000]}")
    return {"imported": config.get("name"), "steps": len(config.get("steps", []))}
```
**Why it's wrong:**
- The blocklist can be bypassed with `127.1`, `[::1]`, `2130706433`, a hostname resolving to `10.0.0.5`, or a 302 redirect to `http://169.254.169.254/` (CWE-918, A10:2021).
- The response body reflected in the error turns the vulnerability into a full-read SSRF: the metadata service's IAM credentials go straight to the attacker.
- `yaml.load` with `yaml.Loader` instantiates objects via `!!python/object/apply` tags: a YAML file hosted by the attacker executes code on the server (CWE-502, A08:2021).
- No size limit and a 30-second timeout make the endpoint usable for resource exhaustion too.

### 2. Cart serialized into a cookie and cache (Java/Spring)
```java
@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper = new ObjectMapper();

    public CartController(StringRedisTemplate redis) {
        this.redis = redis;
        // global polymorphic typing "to support every kind of item"
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
    }

    // the cart travels in the cookie as a Base64-serialized Java object
    @GetMapping
    public Cart restore(@CookieValue("CART") String cookie) throws Exception {
        byte[] data = Base64.getDecoder().decode(cookie);
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(data))) {
            return (Cart) in.readObject();   // the cast happens after deserialization
        }
    }

    @PostMapping("/items")
    public Cart addItem(@RequestBody String json, @CookieValue("CART_ID") String cartId) throws Exception {
        CartItem item = mapper.readValue(json, CartItem.class);   // accepts arbitrary "@class"
        Cart cart = mapper.readValue(redis.opsForValue().get("cart:" + cartId), Cart.class);
        cart.add(item);
        redis.opsForValue().set("cart:" + cartId, mapper.writeValueAsString(cart));
        return cart;
    }
}
```
**Why it's wrong:**
- `readObject()` on a client-controlled cookie instantiates any serializable class on the classpath: with known gadget chains (Commons Collections, Spring, Groovy) this yields pre-authentication RCE (CWE-502, A08:2021, CVSS 9.8).
- The cast to `Cart` happens only after the entire object graph has been built, so it offers no protection.
- `activateDefaultTyping` with `LaissezFaireSubTypeValidator` accepts any `@class` in the JSON: the same vulnerability class documented by CVE-2017-7525 and its successors.
- A client-chosen `CART_ID` allows reading and overwriting other users' carts (CWE-639, A01:2021).

### 3. XML invoice import and preferences in a cookie (Node.js/TypeScript)
```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import libxmljs from 'libxmljs2';
import serialize from 'node-serialize';

const app = express();
app.use(cookieParser());

// import of XML invoices uploaded by suppliers (Italian FatturaPA format)
app.post('/api/invoices/import', express.text({ type: 'application/xml', limit: '10mb' }), (req, res) => {
  // noent: true substitutes entities, including external ones (file://, http://)
  const doc = libxmljs.parseXml(req.body, { noent: true, dtdload: true });
  const number = doc.get('//Numero')?.text();
  const total = doc.get('//ImportoTotaleDocumento')?.text();
  res.json({ number, total });
});

// user preferences stored in the cookie as a serialized object
app.get('/api/preferences', (req, res) => {
  const raw = Buffer.from(req.cookies.prefs ?? '', 'base64').toString('utf8');
  const prefs = serialize.unserialize(raw);
  res.json(prefs);
});

app.listen(3000);
```
**Why it's wrong:**
- `noent: true` expands external entities: a DOCTYPE with `SYSTEM "file:///etc/passwd"` in the `Numero` field returns the file in the response (CWE-611, A05:2021); with an `http://` URL it becomes SSRF (CWE-918).
- `dtdload: true` and a 10 MB limit also enable entity expansion (billion laughs, CWE-776).
- `node-serialize.unserialize` evaluates functions marked `_$$ND_FUNC$$_`: a modified cookie executes code on the server (CVE-2017-5941, CWE-502, A08:2021).
- The cookie is not signed: any content reaches the deserializer without an integrity check.

## Best Practice (How to do it right)

### 1. Importing a YAML pipeline from a user-supplied URL (Python/FastAPI)
```python
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx
import yaml
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

app = FastAPI()
ALLOWED_HOSTS = {"config.example.com", "raw.githubusercontent.com"}
MAX_BYTES = 1_000_000


class ImportRequest(BaseModel):
    url: HttpUrl


def resolve_public_ip(host: str) -> str:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(400, "Destination cannot be resolved")
    addrs = {ipaddress.ip_address(info[4][0]) for info in infos}
    # every address must be public: no loopback, RFC 1918, link-local, CGNAT, ULA
    if not addrs or any(not a.is_global or getattr(a, "ipv4_mapped", None) for a in addrs):
        raise HTTPException(400, "Destination not allowed")
    return str(sorted(addrs, key=str)[0])


@app.post("/api/pipelines/import")
def import_pipeline(req: ImportRequest):
    parts = urlsplit(str(req.url))
    if (parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS
            or parts.port not in (None, 443) or parts.username or parts.password):
        raise HTTPException(400, "URL not allowed")
    ip = resolve_public_ip(parts.hostname)
    netloc = f"[{ip}]" if ":" in ip else ip
    pinned_url = parts._replace(netloc=netloc).geturl()  # connection to the already-validated IP
    body = bytearray()
    with httpx.Client(follow_redirects=False, timeout=httpx.Timeout(10.0, connect=3.0)) as client:
        with client.stream("GET", pinned_url, headers={"Host": parts.hostname},
                           extensions={"sni_hostname": parts.hostname}) as resp:  # TLS verified on the hostname
            if resp.status_code != 200:
                raise HTTPException(502, "Import failed")  # no details of the response
            for chunk in resp.iter_bytes():
                body += chunk
                if len(body) > MAX_BYTES:
                    raise HTTPException(413, "File too large")
    try:
        config = yaml.safe_load(bytes(body))  # only standard YAML types, no Python objects
    except yaml.YAMLError:
        raise HTTPException(400, "Invalid YAML")
    if not isinstance(config, dict) or not isinstance(config.get("steps", []), list):
        raise HTTPException(400, "Invalid pipeline format")
    return {"imported": str(config.get("name", "")), "steps": len(config.get("steps", []))}
```
**Why it's right:**
- Scheme, host, and port allowlist with a standard parser; userinfo and non-standard ports are rejected before any connection.
- Every resolved address must be global (`is_global` excludes loopback, RFC 1918, 169.254/16, 100.64/10, ULA) and the connection is made to the validated IP with the original `Host` and SNI: no window for DNS rebinding and TLS verification preserved.
- Redirects disabled, short timeouts, streaming reads with a 1 MB cap, and no remote content reflected in errors.
- `yaml.safe_load` builds only primitive types and the structure is validated before use.

### 2. Cart serialized into a cookie and cache (Java/Spring)
```java
// allowed subtypes listed explicitly: no default typing
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = ProductItem.class, name = "product"),
    @JsonSubTypes.Type(value = GiftCardItem.class, name = "giftcard")
})
public sealed interface CartItem permits ProductItem, GiftCardItem {}

public record ProductItem(@NotBlank String sku, @Min(1) @Max(99) int qty) implements CartItem {}
public record GiftCardItem(@NotBlank String code, @Positive BigDecimal amount) implements CartItem {}
public record Cart(List<CartItem> items) {}

@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;   // Spring bean, no default typing enabled

    public CartController(StringRedisTemplate redis, ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    // server-side state keyed by the authenticated user: no object in the cookie
    @GetMapping
    public Cart restore(@AuthenticationPrincipal AppUser user) throws JsonProcessingException {
        String json = redis.opsForValue().get("cart:" + user.getId());
        return json == null ? new Cart(List.of()) : mapper.readValue(json, Cart.class);
    }

    @PostMapping("/items")
    public Cart addItem(@Valid @RequestBody CartItem item, @AuthenticationPrincipal AppUser user)
            throws JsonProcessingException {
        List<CartItem> items = new ArrayList<>(restore(user).items());
        items.add(item);
        Cart updated = new Cart(List.copyOf(items));
        redis.opsForValue().set("cart:" + user.getId(), mapper.writeValueAsString(updated), Duration.ofDays(7));
        return updated;
    }
}

// only for migrating old cookies: allowlist filter with limits
final class LegacyCartReader {

    private static final ObjectInputFilter FILTER = ObjectInputFilter.Config.createFilter(
        "maxdepth=5;maxrefs=500;maxbytes=65536;com.example.legacy.LegacyCart;java.util.ArrayList;java.lang.String;!*");

    static Object read(byte[] data) throws IOException, ClassNotFoundException {
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(data))) {
            in.setObjectInputFilter(FILTER);   // InvalidClassException for classes outside the allowlist
            return in.readObject();
        }
    }
}
```
**Why it's right:**
- The cart is JSON stored on the server and keyed by the authenticated user: the client no longer carries serialized objects or chooses the cart ID.
- Polymorphism uses `Id.NAME` with closed subtypes (`sealed interface` + `@JsonSubTypes`): only `"product"` or `"giftcard"` can appear in the JSON, never a class name.
- Records with Bean Validation constrain values and quantities already at binding time.
- Any legacy read applies an `ObjectInputFilter` with an explicit allowlist, a trailing `!*`, and limits on depth, references, and bytes.

### 3. XML invoice import and preferences in a cookie (Node.js/TypeScript)
```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';

const app = express();
app.use(cookieParser(process.env.COOKIE_SECRET)); // HMAC-signed cookies

// fast-xml-parser does not load DTDs or resolve external entities
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,        // "001" stays a string
});

// element names follow the Italian FatturaPA e-invoice schema
const Invoice = z.object({
  Numero: z.string().max(20),
  ImportoTotaleDocumento: z.coerce.number().nonnegative(),
});

app.post('/api/invoices/import', express.text({ type: 'application/xml', limit: '2mb' }), (req, res) => {
  const xml = String(req.body);
  // the format does not use DTDs: any DOCTYPE is rejected (XXE and billion laughs)
  if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) {
    return res.status(400).json({ error: 'Invalid XML' });
  }
  const doc = parser.parse(xml);
  const parsed = Invoice.safeParse(
    doc?.FatturaElettronica?.FatturaElettronicaBody?.DatiGenerali?.DatiGeneraliDocumento);
  if (!parsed.success) return res.status(422).json({ error: 'Required fields missing' });
  res.json({ number: parsed.data.Numero, total: parsed.data.ImportoTotaleDocumento });
});

const Preferences = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  pageSize: z.number().int().min(10).max(100).default(20),
}).strict();

app.get('/api/preferences', (req, res) => {
  // signedCookies contains false if the signature is invalid
  const raw = req.signedCookies?.prefs;
  let data: unknown = {};
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { data = {}; }   // data only, never functions
  }
  const prefs = Preferences.safeParse(data);
  res.json(prefs.success ? prefs.data : Preferences.parse({}));
});

app.listen(3000);
```
**Why it's right:**
- The DOCTYPE is rejected before parsing and `fast-xml-parser` with `processEntities: false` does not expand entities: no XXE, no SSRF via DTD, no billion laughs; the limit drops to 2 MB.
- Extracted fields are validated with zod and `parseTagValue: false` preserves textual values such as invoice numbers with leading zeros.
- Preferences are plain JSON in a signed cookie: `JSON.parse` executes no code and the HMAC signature discards tampered cookies.
- The `.strict()` schema with default values limits the accepted state to the expected fields only.
