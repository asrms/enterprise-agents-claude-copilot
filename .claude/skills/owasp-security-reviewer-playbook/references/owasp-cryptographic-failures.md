# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Encrypting personal data and a search index (Java/Spring)
```java
@Component
public class PiiEncryptor {

    // "temporary" key left in the code and therefore in git history
    private static final byte[] KEY = "Sup3rS3cr3tK3y!!".getBytes(StandardCharsets.UTF_8);

    public String encrypt(String plaintext) {
        try {
            Cipher cipher = Cipher.getInstance("AES");   // = AES/ECB/PKCS5Padding
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(KEY, "AES"));
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ct);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String decrypt(String encoded) {
        try {
            Cipher cipher = Cipher.getInstance("AES");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(KEY, "AES"));
            byte[] pt = cipher.doFinal(Base64.getDecoder().decode(encoded));
            return new String(pt, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    // "fingerprint" of the tax code for exact-match searches
    public String fingerprint(String taxCode) throws NoSuchAlgorithmException {
        MessageDigest md = MessageDigest.getInstance("MD5");
        return HexFormat.of().formatHex(md.digest(taxCode.getBytes(StandardCharsets.UTF_8)));
    }
}
```
**Why it's wrong:**
- `Cipher.getInstance("AES")` uses ECB: identical plaintexts produce identical ciphertexts, patterns remain visible, and there is no integrity protection at all (CWE-327, A02:2021).
- The key is hardcoded, has 128 bits derived from a readable string, lives in the repository, and cannot be rotated without a release (CWE-321, A02:2021).
- An unsalted MD5 of a tax code, a structured low-entropy value, can be inverted by enumeration: the "fingerprint" is equivalent to the plaintext data (CWE-328).
- No binding between ciphertext and record: an attacker with DB access can move encrypted values between rows undetected.

### 2. Webhook signature, API keys, and a call to the partner (Node.js/TypeScript)
```typescript
import crypto from 'node:crypto';
import https from 'node:https';
import express from 'express';
import axios from 'axios';
import { processPayment } from './payments';

const WEBHOOK_SECRET = 'whsec_live_8f2a91';   // secret in the code
const app = express();

app.post('/webhooks/payments', express.text({ type: '*/*' }), (req, res) => {
  const signature = req.header('X-Signature') ?? '';
  // "signature" = md5(secret + body), compared with !==
  const expected = crypto.createHash('md5').update(WEBHOOK_SECRET + req.body).digest('hex');
  if (signature !== expected) return res.status(401).end();
  processPayment(JSON.parse(req.body));
  res.status(204).end();
});

export function newApiKey(): string {
  return 'ak_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// the internal CA certificate "was throwing errors"
const agent = new https.Agent({ rejectUnauthorized: false });

export async function notifyPartner(payload: unknown): Promise<void> {
  await axios.post('https://partner.example.com/notify', payload, { httpsAgent: agent });
}
```
**Why it's wrong:**
- `md5(secret + body)` is not a MAC: MD5 is broken and the secret‖message construction is subject to length extension (CWE-327/CWE-328, A02:2021).
- Comparing with `!==` stops at the first differing byte and makes the signature reconstructible via timing (CWE-208); without a timestamp a valid webhook can be replayed.
- `Math.random()` is not cryptographically secure: API keys are predictable (CWE-338, A02:2021) and, returned in plaintext, would be stored that way in the DB.
- `rejectUnauthorized: false` accepts any certificate: anyone on the network path intercepts the data sent to the partner (CWE-295, A07:2021).

### 3. Encrypted report export and download code (Python)
```python
import hashlib
import random
import string

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

EXPORT_KEY = b"0123456789abcdef0123456789abcdef"  # 32 hardcoded bytes
STATIC_IV = b"\x00" * 16


def export_report(csv_bytes: bytes) -> dict:
    cipher = AES.new(EXPORT_KEY, AES.MODE_CBC, iv=STATIC_IV)
    ciphertext = cipher.encrypt(pad(csv_bytes, 16))
    checksum = hashlib.sha1(csv_bytes).hexdigest()  # "integrity"
    download_code = "".join(random.choice(string.digits) for _ in range(6))
    requests.post(
        "https://archive.internal/api/upload",
        files={"file": ciphertext},
        data={"sha1": checksum, "code": download_code},
        verify=False,  # internal CA not configured
    )
    return {"code": download_code}


def check_download_code(provided: str, stored: str) -> bool:
    return provided == stored
```
**Why it's wrong:**
- CBC with a static IV makes the encryption of the first blocks deterministic and, without a MAC, exposes it to tampering and padding oracles (CWE-329/CWE-327, A02:2021).
- The plaintext SHA-1 next to the ciphertext does not guarantee integrity and reveals whether two exports are identical.
- Hardcoded key (CWE-321), a 6-digit download code from `random` (CWE-338), and comparison with `==` (CWE-208).
- `verify=False` disables server authentication: the report and the code travel to whoever sits in between (CWE-295, A07:2021).

## Best Practice (How to do it right)

### 1. Encrypting personal data and a search index (Java/Spring)
```java
@Component
public class PiiEncryptor {

    private static final int NONCE_LEN = 12;   // 96 bits
    private static final int TAG_BITS = 128;
    private static final byte VERSION = 1;     // key version stored with the data

    private final SecretKey dataKey;           // AES-256 DEK decrypted via KMS at startup
    private final SecretKey indexKey;          // distinct HMAC key for the blind index
    private final SecureRandom random = new SecureRandom();

    public PiiEncryptor(KeyProvider keys) {    // wrapper over AWS KMS / Vault Transit
        this.dataKey = keys.dataKey("pii", VERSION);
        this.indexKey = keys.hmacKey("pii-index", VERSION);
    }

    public byte[] encrypt(String plaintext, String context) throws GeneralSecurityException {
        byte[] nonce = new byte[NONCE_LEN];
        random.nextBytes(nonce);                // unique nonce for every encryption
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, dataKey, new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));   // e.g. "customer:42:taxCode"
        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return ByteBuffer.allocate(1 + NONCE_LEN + ct.length)
                         .put(VERSION).put(nonce).put(ct).array();     // version|nonce|ct+tag
    }

    public String decrypt(byte[] blob, String context) throws GeneralSecurityException {
        ByteBuffer buf = ByteBuffer.wrap(blob);
        if (buf.get() != VERSION) {
            throw new GeneralSecurityException("Unsupported key version");
        }
        byte[] nonce = new byte[NONCE_LEN];
        buf.get(nonce);
        byte[] ct = new byte[buf.remaining()];
        buf.get(ct);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, dataKey, new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
        return new String(cipher.doFinal(ct), StandardCharsets.UTF_8); // AEADBadTagException if tampered
    }

    public String blindIndex(String taxCode) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(indexKey);
        String normalized = taxCode.trim().toUpperCase(Locale.ROOT);
        return HexFormat.of().formatHex(mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8)));
    }
}
```
**Why it's right:**
- AES-256-GCM with a random 96-bit nonce per encryption and a 128-bit tag provides confidentiality and integrity; the AAD prevents moving ciphertexts between records or fields.
- Keys come from the KMS via `KeyProvider` and the version stored in the blob enables rotation and progressive re-encryption.
- The blind index uses HMAC-SHA-256 with a dedicated key: without the key the tax codes cannot be enumerated.
- Any tampering with the encrypted data raises `AEADBadTagException` instead of returning corrupted data.

### 2. Webhook signature, API keys, and a call to the partner (Node.js/TypeScript)
```typescript
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import express from 'express';
import axios from 'axios';
import { processPayment } from './payments';

// secret injected from Vault/KMS as an environment variable, at least 256 bits
const WEBHOOK_SECRET = Buffer.from(process.env.WEBHOOK_SECRET ?? '', 'base64');
if (WEBHOOK_SECRET.length < 32) throw new Error('WEBHOOK_SECRET missing or too short');
const TOLERANCE_S = 300;
const app = express();

app.post('/webhooks/payments', express.raw({ type: 'application/json', limit: '256kb' }), (req, res) => {
  const ts = Number(req.header('X-Timestamp'));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) {
    return res.status(401).end();                       // anti-replay
  }
  const received = Buffer.from(req.header('X-Signature') ?? '', 'hex');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(`${ts}.`)
    .update(req.body as Buffer)
    .digest();
  // timingSafeEqual requires buffers of the same length
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.status(401).end();
  }
  processPayment(JSON.parse((req.body as Buffer).toString('utf8')));
  res.status(204).end();
});

export function newApiKey(): { key: string; hash: string } {
  const key = 'ak_' + crypto.randomBytes(32).toString('base64url');   // 256 bits from a CSPRNG
  const hash = crypto.createHash('sha256').update(key).digest('hex'); // only the hash in the DB
  return { key, hash };
}

// explicit internal CA: chain and hostname verification stay enabled
const agent = new https.Agent({ ca: fs.readFileSync('/etc/pki/partner-ca.pem'), minVersion: 'TLSv1.2' });

export async function notifyPartner(payload: unknown): Promise<void> {
  await axios.post('https://partner.example.com/notify', payload, { httpsAgent: agent, timeout: 5000 });
}
```
**Why it's right:**
- HMAC-SHA-256 computed over the raw body and the timestamp, compared with `timingSafeEqual` after the length check: no length extension, no timing leak, replay limited to 5 minutes (to be completed with event ID deduplication).
- The secret is not in the code and startup fails if it is missing or short (fail closed).
- API keys have 256 bits of entropy from `randomBytes` and are persisted only as SHA-256, which is sufficient for high-entropy secrets.
- The internal CA is trusted explicitly with TLS ≥ 1.2, instead of disabling verification.

### 3. Encrypted report export and download code (Python)
```python
import hashlib
import hmac
import secrets

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .kms import generate_data_key  # envelope encryption: plaintext DEK + DEK encrypted by the KEK

ARCHIVE_URL = "https://archive.internal/api/upload"
INTERNAL_CA = "/etc/pki/tls/certs/internal-ca.pem"  # corporate CA for TLS verification

_session = requests.Session()
_session.verify = INTERNAL_CA


def export_report(csv_bytes: bytes, report_id: str) -> dict:
    dek_plain, dek_wrapped = generate_data_key(key_id="alias/report-export")  # AES-256
    nonce = secrets.token_bytes(12)                  # 96 bits, unique per DEK
    aad = f"report:{report_id}:v1".encode()
    ciphertext = AESGCM(dek_plain).encrypt(nonce, csv_bytes, aad)  # includes the integrity tag
    download_code = secrets.token_urlsafe(16)        # 128 bits from a CSPRNG
    resp = _session.post(
        ARCHIVE_URL,
        files={"file": (f"{report_id}.bin", nonce + ciphertext)},
        data={"wrapped_key": dek_wrapped.hex(), "alg": "AES-256-GCM", "v": "1"},
        timeout=10,
    )
    resp.raise_for_status()
    # the caller gets the code to hand to the user, to be persisted only as a hash
    return {"code": download_code,
            "code_sha256": hashlib.sha256(download_code.encode()).hexdigest()}


def check_download_code(provided: str, stored_sha256: str) -> bool:
    provided_digest = hashlib.sha256(provided.encode()).hexdigest()
    return hmac.compare_digest(provided_digest, stored_sha256)  # constant-time comparison
```
**Why it's right:**
- AES-256-GCM with a dedicated DEK per export and a random nonce replaces CBC with a static IV and a SHA-1 checksum: integrity and confidentiality in a single primitive, bound to the report via AAD.
- The DEK travels only encrypted by the KMS's KEK (envelope encryption): no key in the code, and KEK rotation independent of the data.
- The download code has 128 bits of entropy, is persisted as a hash, and is verified with `hmac.compare_digest`.
- The HTTP session verifies the certificate with the internal CA, with an explicit timeout and a status check.
