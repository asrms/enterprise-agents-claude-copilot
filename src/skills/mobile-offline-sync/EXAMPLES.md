# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Online-only writes with blind retries
```typescript
async function saveNote(note: Note) {
  if (!(await NetInfo.fetch()).isConnected) {
    alert('You are offline')                            // user work is lost
    return
  }
  for (let i = 0; i < 5; i++) {
    try {
      await api.post('/notes', note)                    // no idempotency key: timeouts create duplicates
      return
    } catch {}                                          // immediate retries, errors swallowed
  }
}
```
**Why it's wrong:**
- The app is unusable offline and discards user input.
- Retrying a non-idempotent POST after a timeout can create duplicate notes; failures are silently ignored.

## Best Practice (How to do it right)

### 1. Local write plus outbox in one transaction (Flutter, Drift)
```dart
Future<void> saveNote(NoteDraft draft) async {
  final mutationId = const Uuid().v4();
  await db.transaction(() async {
    await db.into(db.notes).insertOnConflictUpdate(NotesCompanion.insert(
      id: draft.id, title: draft.title, body: draft.body,
      version: Value(draft.baseVersion), syncState: const Value(SyncState.pending),
    ));
    await db.into(db.outbox).insert(OutboxCompanion.insert(
      mutationId: mutationId, entity: 'note', entityId: draft.id,
      operation: 'upsert', payload: jsonEncode(draft.toJson()),
    ));
  });
  syncScheduler.requestSync();                       // UI already shows the note from the local stream
}
```
### 2. Sync loop with idempotency, backoff, and conflict detection
```dart
Future<void> pushOutbox() async {
  for (final item in await db.pendingOutboxOrdered()) {
    try {
      final res = await api.put(
        '/notes/${item.entityId}',
        data: item.payload,
        options: Options(headers: {'Idempotency-Key': item.mutationId, 'If-Match': '"${item.baseVersion}"'}),
      );
      await db.markSynced(item, serverVersion: res.data['version'] as int);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 412) {
        await db.markConflict(item);                 // user resolves, or a merge policy runs
      } else if (status != null && status >= 400 && status < 500 && status != 429) {
        await db.markFailed(item, reason: e.message);  // permanent: surface to the user
      } else {
        await db.scheduleRetry(item, delay: backoffWithJitter(item.attempts));
        break;                                        // keep ordering: stop and retry later
      }
    }
  }
}
```
**Why it's right:**
- The note is saved locally and queued atomically, so the UI works offline and nothing is lost.
- Each mutation has an idempotency key, conflicts are detected with versions, and errors are classified with backoff for transient failures.
