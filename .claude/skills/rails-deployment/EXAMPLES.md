# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual server deploys
```bash
ssh deploy@app1 'cd /srv/shop && git pull && bundle install && rails assets:precompile && rails db:migrate && touch tmp/restart.txt'
ssh deploy@app2 '...same, a few minutes later...'   # two versions serve traffic with an unmigrated DB in between
# master.key copied to the servers by email; uploads stored in /srv/shop/storage on each server
```
**Why it's wrong:**
- Builds happen on servers, servers drift, and migrations race with running code.
- The master key is shared insecurely, and uploads are not shared between servers.

## Best Practice (How to do it right)

### 1. Kamal 2 deployment configuration
`config/deploy.yml`:
```yaml
service: shop
image: example/shop

servers:
  web:
    hosts: [10.0.1.10, 10.0.1.11]
  job:
    hosts: [10.0.1.20]
    cmd: bin/jobs

proxy:
  ssl: true
  host: shop.example.com
  healthcheck:
    path: /up

registry:
  server: registry.example.com
  username: deploy
  password:
    - KAMAL_REGISTRY_PASSWORD

env:
  clear:
    RAILS_LOG_TO_STDOUT: "1"
    WEB_CONCURRENCY: 2
    RAILS_MAX_THREADS: 5
    SOLID_QUEUE_IN_PUMA: false
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_URL

builder:
  arch: amd64
```
`.kamal/secrets`:
```bash
KAMAL_REGISTRY_PASSWORD=$(op read "op://deploy/registry/password")
RAILS_MASTER_KEY=$(op read "op://deploy/shop-production/master_key")
DATABASE_URL=$(op read "op://deploy/shop-production/database_url")
```
```bash
kamal deploy          # builds, pushes, runs db:prepare via the entrypoint, swaps containers with zero downtime
kamal rollback <previous-version>
```
**Why it's right:**
- Images are built once and deployed identically to web and job roles; the proxy only routes to healthy containers.
- Secrets come from a password manager at deploy time, workers run separately, and rollback is one command.
