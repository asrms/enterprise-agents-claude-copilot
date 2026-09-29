# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Home-made encryption with a hard-coded key
```python
KEY = b"0123456789abcdef"                                    # in source control, never rotated

def encrypt(value: str) -> bytes:
    cipher = AES.new(KEY, AES.MODE_ECB)                      # ECB leaks patterns, no integrity
    return cipher.encrypt(pad(value.encode(), 16))

db.execute("UPDATE patient SET diagnosis = %s", (encrypt(diagnosis),))
requests.get(LAB_API_URL, verify=False)                     # TLS certificate validation disabled
```
**Why it's wrong:**
- The key is in the code and next to the data; ECB without authentication allows pattern analysis and tampering.
- Disabling certificate validation enables man-in-the-middle attacks.

## Best Practice (How to do it right)

### 1. Envelope encryption with Tink and a cloud KMS KEK (Python)
```python
import tink
from tink import aead
from tink.integration import gcpkms

aead.register()
KEK_URI = "gcp-kms://projects/acme-prod/locations/europe-west1/keyRings/phi/cryptoKeys/patient-fields"

kms_client = gcpkms.GcpKmsClient(KEK_URI, credentials_path=None)       # workload identity credentials
remote_aead = kms_client.get_aead(KEK_URI)
envelope = aead.KmsEnvelopeAead(aead.aead_key_templates.AES256_GCM, remote_aead)

def encrypt_field(plaintext: str, patient_id: str) -> bytes:
    # associated data binds the ciphertext to its row and column, preventing swaps between records
    return envelope.encrypt(plaintext.encode(), f"patient:{patient_id}:diagnosis".encode())

def decrypt_field(ciphertext: bytes, patient_id: str) -> str:
    return envelope.decrypt(ciphertext, f"patient:{patient_id}:diagnosis".encode()).decode()
```
### 2. Customer-managed key with rotation and separated duties (Terraform, AWS)
```hcl
resource "aws_kms_key" "invoices" {
  description             = "CMK for invoice storage"
  enable_key_rotation     = true
  rotation_period_in_days = 365
  deletion_window_in_days = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "KeyAdmins", Effect = "Allow",
        Principal = { AWS = "arn:aws:iam::111122223333:role/KmsAdministrators" },
        Action = ["kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*", "kms:Put*", "kms:Update*",
                  "kms:Revoke*", "kms:Disable*", "kms:Get*", "kms:TagResource", "kms:ScheduleKeyDeletion",
                  "kms:CancelKeyDeletion"],
        Resource = "*" },
      { Sid = "InvoiceServiceUse", Effect = "Allow",
        Principal = { AWS = aws_iam_role.invoice_service.arn },
        Action = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
        Resource = "*",
        Condition = { StringEquals = { "kms:ViaService" = "s3.eu-west-1.amazonaws.com" } } }
    ]
  })
}
```
**Why it's right:**
- Data keys are generated per encryption and wrapped by a KMS key that never leaves the KMS; AEAD with associated data provides integrity.
- Administrators manage but cannot use the key, the service can use it only through S3, rotation is automatic, and deletion has a waiting period.
