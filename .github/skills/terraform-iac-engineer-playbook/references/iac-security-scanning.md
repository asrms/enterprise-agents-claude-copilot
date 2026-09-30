# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Insecure resources that no scanner checks
```hcl
resource "aws_security_group_rule" "ssh" {
  type        = "ingress"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]                 # SSH open to the internet
  security_group_id = aws_security_group.app.id
}

resource "aws_db_instance" "main" {
  engine              = "postgres"
  instance_class      = "db.t4g.medium"
  publicly_accessible = true
  storage_encrypted   = false
  password            = "ChangeMe123!"        # secret in code and state
}

resource "aws_iam_role_policy" "app" {
  role   = aws_iam_role.app.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }] })
}
```
**Why it's wrong:**
- Public SSH, a public unencrypted database, a hard-coded password, and an administrator policy on an application role.
- Without automated scanning these reach production unnoticed.

## Best Practice (How to do it right)

### 1. Secure configuration
```hcl
resource "aws_db_instance" "main" {
  engine                        = "postgres"
  instance_class                = "db.t4g.medium"
  publicly_accessible           = false
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.data.arn
  manage_master_user_password   = true            # stored and rotated in Secrets Manager
  iam_database_authentication_enabled = true
  deletion_protection           = true
  db_subnet_group_name          = aws_db_subnet_group.private.name
  vpc_security_group_ids        = [aws_security_group.db.id]
}

resource "aws_iam_role_policy" "app" {
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${aws_s3_bucket.uploads.arn}/tenants/*"
    }]
  })
}
```
### 2. Scanning in pre-commit and CI
`.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.99.0
    hooks:
      - id: terraform_fmt
      - id: terraform_tflint
      - id: terraform_checkov
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.27.2
    hooks:
      - id: gitleaks
```
```bash
terraform plan -out tfplan && terraform show -json tfplan > tfplan.json
checkov -f tfplan.json --framework terraform_plan --output sarif --output-file-path results/
trivy config --severity HIGH,CRITICAL --exit-code 1 .
```
**Why it's right:**
- The database is private, encrypted, protected from deletion, and its password is managed by the cloud provider.
- The application role is limited to the actions and resource prefix it needs.
- Scanners run on every commit and on the resolved plan, failing the build on serious findings and reporting SARIF.
