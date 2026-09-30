# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Broad roles and static keys across providers
```text
AWS:   IAM user "ci-deployer" with AdministratorAccess and an access key from 2022
Azure: app registration with client secret, Contributor on the whole subscription
GCP:   service account key JSON committed to a private repo, roles/editor on the production project
Humans: named IAM users with console passwords, no MFA enforcement
```
**Why it's wrong:**
- A single leaked key grants full control of production, and broad roles allow privilege escalation.
- Individual cloud users bypass the identity provider's MFA, lifecycle, and audit controls.

## Best Practice (How to do it right)

### 1. Scoped workload role with conditions (AWS)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteOwnPrefix",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::acme-invoices-prod/tenants/*",
      "Condition": { "StringEquals": { "aws:ResourceOrgID": "o-a1b2c3d4e5" } }
    },
    {
      "Sid": "DecryptWithInvoiceKeyViaS3Only",
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:eu-west-1:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab",
      "Condition": { "StringEquals": { "kms:ViaService": "s3.eu-west-1.amazonaws.com" } }
    }
  ]
}
```
### 2. Organization guardrail (AWS SCP) preventing security control tampering
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyLoggingTampering",
    "Effect": "Deny",
    "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "guardduty:DeleteDetector", "config:StopConfigurationRecorder"],
    "Resource": "*",
    "Condition": { "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlass" } }
  }]
}
```
### 3. Azure and GCP equivalents (Terraform)
```hcl
resource "azurerm_role_assignment" "invoice_writer" {
  scope                = azurerm_storage_container.invoices.resource_manager_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.invoice_service.principal_id
}

resource "google_storage_bucket_iam_member" "invoice_writer" {
  bucket = google_storage_bucket.invoices.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.invoice_service.email}"
}
```
**Why it's right:**
- Workloads use platform identities with permissions scoped to one bucket or container and one key, with conditions.
- Organization-level guardrails prevent disabling audit controls even by account administrators.
- Role assignments are defined as code at the narrowest scope in every provider.
