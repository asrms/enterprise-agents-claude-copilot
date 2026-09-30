# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Nightly dump on the same server, never restored
```bash
# crontab on the database host
0 2 * * * pg_dump -U postgres shop > /var/backups/shop.sql
```
**Why it's wrong:**
- RPO is up to 24 hours and there is no point-in-time recovery.
- The backup lives on the same host and disk as the database: losing the host, a ransomware attack, or a `rm` destroys both.
- Nobody knows whether it restores or how long a restore takes; failures of the cron job go unnoticed.

## Best Practice (How to do it right)

### 1. PITR with pgBackRest to immutable, off-site storage
`/etc/pgbackrest/pgbackrest.conf`:
```ini
[global]
repo1-type=s3
repo1-s3-bucket=acme-db-backups-dr
repo1-s3-region=eu-west-1
repo1-s3-endpoint=s3.eu-west-1.amazonaws.com
repo1-path=/shop
repo1-retention-full=4
repo1-cipher-type=aes-256-cbc
process-max=4
backup-standby=y

[shop]
pg1-path=/var/lib/postgresql/17/main
```
`postgresql.conf`:
```ini
archive_mode = on
archive_command = 'pgbackrest --stanza=shop archive-push %p'
```
```bash
# weekly full, daily differential (run by the scheduler, alerts on failure)
pgbackrest --stanza=shop --type=full backup
pgbackrest --stanza=shop --type=diff backup

# restore drill to an isolated host: recover to a precise point in time
pgbackrest --stanza=shop --type=time --target="2026-09-29 10:14:00+00" --delta restore
```
**Why it's right:**
- Continuous WAL archiving gives an RPO of seconds to minutes and precise point-in-time restores.
- Backups are encrypted and stored in another region in a bucket with object lock, taken from the standby to spare the primary.
- The restore command is exercised in scheduled drills that measure the real RTO.

### 2. HA cluster with automatic failover (CloudNativePG on Kubernetes)
```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: shop-db
spec:
  instances: 3
  minSyncReplicas: 1
  maxSyncReplicas: 1
  affinity:
    topologyKey: topology.kubernetes.io/zone
  storage:
    size: 200Gi
  backup:
    retentionPolicy: 30d
    barmanObjectStore:
      destinationPath: s3://acme-db-backups-dr/shop
      s3Credentials:
        inheritFromIAMRole: true
      wal:
        compression: gzip
        encryption: AES256
```
**Why it's right:**
- Three instances spread across zones with one synchronous replica: a zone failure loses no committed transaction, and failover is automatic.
- Applications connect to the stable read-write service, which follows the new primary after failover.
- WAL archiving and base backups to off-site storage are declared with the cluster, not configured by hand.
