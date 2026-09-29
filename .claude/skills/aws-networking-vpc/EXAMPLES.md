# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Single-AZ VPC with open administrative access
```hcl
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "eu-west-1a"                 # single AZ
  map_public_ip_on_launch = true
}

resource "aws_security_group" "db" {
  vpc_id = aws_vpc.main.id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]                            # database open to the internet
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]                            # SSH from anywhere
  }
}
```
**Why it's wrong:**
- One AZ means one failure domain; everything, including the database, sits in a public subnet with public IPs.
- The database and SSH are exposed to the internet, and no flow logs exist to investigate access.

## Best Practice (How to do it right)

### 1. Multi-AZ tiers, private endpoints, SG references, and flow logs
```hcl
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

resource "aws_subnet" "app" {
  for_each          = { for i, az in local.azs : az => i }
  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 4, each.value)
  tags              = { Name = "orders-prod-app-${each.key}", tier = "app" }
}

resource "aws_subnet" "data" {
  for_each          = { for i, az in local.azs : az => i }
  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 4, each.value + 4)
  tags              = { Name = "orders-prod-data-${each.key}", tier = "data" }
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [for rt in aws_route_table.private : rt.id]
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL from application tier only"
}

resource "aws_flow_log" "main" {
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "s3"
  log_destination          = var.flow_log_bucket_arn    # bucket in the log archive account
  max_aggregation_interval = 60
}
```
**Why it's right:**
- Subnets are created per AZ with `for_each` on stable keys; data subnets have no internet route.
- S3 traffic stays on the AWS network through a gateway endpoint instead of NAT.
- The database accepts traffic only from the application security group, and all traffic is logged centrally.
