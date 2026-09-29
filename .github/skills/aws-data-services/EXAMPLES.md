# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Public, unencrypted, single-AZ data layer
```hcl
resource "aws_db_instance" "orders" {
  engine              = "postgres"
  instance_class      = "db.m7g.large"
  multi_az            = false
  publicly_accessible = true
  storage_encrypted   = false
  username            = "admin"
  password            = "Orders2026!"
  backup_retention_period = 0
  skip_final_snapshot     = true
}

resource "aws_s3_bucket_acl" "exports" {
  bucket = aws_s3_bucket.exports.id
  acl    = "public-read"
}
```
**Why it's wrong:**
- The database is internet-reachable, unencrypted, single-AZ, without backups, and has a hard-coded password.
- Customer exports are publicly readable.

## Best Practice (How to do it right)

### 1. Aurora PostgreSQL with HA, encryption, managed credentials, and PITR
```hcl
resource "aws_rds_cluster" "orders" {
  cluster_identifier              = "orders-prod"
  engine                          = "aurora-postgresql"
  engine_version                  = "16.6"
  database_name                   = "orders"
  master_username                 = "orders_admin"
  manage_master_user_password     = true                      # stored and rotated in Secrets Manager
  iam_database_authentication_enabled = true
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.data.arn
  db_subnet_group_name            = aws_db_subnet_group.data.name
  vpc_security_group_ids          = [aws_security_group.orders_db.id]
  backup_retention_period         = 14
  deletion_protection             = true
  copy_tags_to_snapshot           = true
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.force_ssl.name
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_rds_cluster_instance" "orders" {
  count                = 2                                        # writer + reader in different AZs
  cluster_identifier   = aws_rds_cluster.orders.id
  instance_class       = "db.r7g.large"
  engine               = aws_rds_cluster.orders.engine
  publicly_accessible  = false
  performance_insights_enabled = true
}
```
### 2. Private, encrypted S3 bucket requiring TLS
```hcl
resource "aws_s3_bucket_public_access_block" "exports" {
  bucket                  = aws_s3_bucket.exports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "exports_tls_only" {
  bucket = aws_s3_bucket.exports.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.exports.arn, "${aws_s3_bucket.exports.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
```
**Why it's right:**
- The database is private, encrypted with a customer-managed key, highly available across AZs, protected from deletion, and recoverable to a point in time.
- Credentials are managed and rotated by AWS; the bucket blocks public access and rejects non-TLS requests.
