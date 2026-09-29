---
name: mobile-offline-sync
description: "Offline-first data and synchronization for mobile apps (Flutter, React Native, native): local database as source of truth (SQLite, Drift, Room, WatermelonDB, op-sqlite), outbox of pending mutations, idempotent sync with retries and backoff, conflict resolution, delta sync with cursors, background sync constraints, and schema migrations. Use it when an app must work with poor or no connectivity."
---

# Skill: Mobile Offline Sync

## Implementation Rules:
- **[ARCHITECTURE]** Make the local database the single source of truth for the UI: screens observe local queries (streams or reactive queries), and a sync engine reconciles the local store with the server in the background.
- **[MANDATORY]** Record user changes locally first and append them to an outbox table (operation, entity id, payload, client mutation id, attempt count) in the same transaction, then send them to the server in order when connectivity allows.
- **[MANDATORY]** Every mutation sent to the server carries a client-generated idempotency key (UUID) so retries after timeouts never create duplicates; the server stores processed keys and returns the original result.
- **[PATTERN]** Retry failed sync with exponential backoff and jitter, distinguish transient errors (network, 5xx, 429) from permanent ones (4xx validation), and surface permanently failed items to the user instead of retrying forever.
- **[PATTERN]** Pull changes with delta sync: a server cursor or `updated_since` token, pagination, and tombstones for deletions, so clients download only what changed.
- **[ARCHITECTURE]** Choose and document a conflict strategy per entity: server-wins, last-writer-wins with server-assigned versions, field-level merge, or user resolution; detect conflicts with a version or ETag sent on update (`If-Match`).
- **[PATTERN]** Use platform schedulers for background sync with constraints (WorkManager on Android, `BGTaskScheduler` on iOS, `workmanager`/`expo-background-task` wrappers), and also sync on app foreground and connectivity regained.
- **[MANDATORY]** Version the local schema and run migrations on upgrade (Drift, Room, or SQLite migration scripts) with tests from every previously shipped version; never wipe user data with unsynced changes.
- **[FORBIDDEN]** Treating connectivity checks as a guarantee (always handle request failures), optimistic updates without a rollback path, client-side timestamps as the only ordering for conflicts, and storing auth tokens or secrets in the sync database.
- **[SECURITY]** Encrypt sensitive local data (SQLCipher or platform file protection), scope the local store to the signed-in user, and clear it on logout or account switch after confirming unsynced changes.
- **[PATTERN]** Show sync status in the UI (pending changes, last synced time, errors) so users understand what has been saved remotely.
- **[TESTING]** Test the sync engine deterministically: fake server with injected failures and latency, airplane-mode scenarios, duplicate delivery, conflicting edits from two devices, and migrations from older schema versions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
