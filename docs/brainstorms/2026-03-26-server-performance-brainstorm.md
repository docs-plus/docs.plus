---
date: 2026-03-26
topic: server-performance
---

# Hocuspocus Server Performance

## What We're Building

Server-side optimizations for the Hocuspocus WebSocket server that directly reduce frontend latency, prevent scaling bottlenecks, and protect against abuse. These are independent of the client-side editor performance work (see `2026-03-26-editor-performance-brainstorm.md`).

## Why This Matters

The Hocuspocus server runs document collaboration, history queries, schema migration, and persistence on a single Node event loop. Heavy operations (unbounded DB queries, CPU-intensive transforms, large payload fan-out) on the WebSocket thread directly translate to editor lag for all connected users on that instance.

## Key Findings

### High Priority — Directly Felt by Users

#### 1. History queries block the WebSocket thread

`onStateless` → `handleHistoryEvents` runs Prisma queries on the same event loop as real-time collaboration. Two problems:

- `history.list` has **no `take` limit** — returns all versions (unbounded). A document with 500+ saves returns everything.
- `history.watch` base64-encodes entire document binary blobs inline — CPU-heavy for large documents.

**Impact:** When any user opens version history, all users on that server instance experience increased latency.

**Fix:** Add pagination to `history.list` (`take: 50`, cursor-based). Frontend already has prev/next navigation — wire it to paginated queries. Moving history to the REST API (separate process) is a larger architectural change — defer to a separate brainstorm if pagination alone doesn't resolve latency.

#### 2. No `maxPayload` on WebSocket

No protection against oversized updates. A single user pasting a massive document fans out a multi-MB Yjs update to all connected users.

**Impact:** One user can cause jank for all collaborators. Known Hocuspocus footgun (maintainers recommend `maxPayload` + `beforeHandleMessage`).

**Fix:** Set `maxPayload` on the Server config (e.g., 5MB). Optionally add `beforeHandleMessage` hook to reject updates exceeding a threshold with a user-friendly error.

#### 3. On-load schema migration is CPU-heavy

`Database.fetch` runs Y decode → TipTap transform → Y re-encode for old-schema documents on every open. For large documents, this blocks the first sync.

**Impact:** Slow initial document load for unmigrated documents.

**Fix:** Run the batch migration script to migrate all documents, then remove the on-load migration path. This is already planned per `ENABLE_SCHEMA_MIGRATION` env flag — the fix is completing the migration and turning it off.

**Bug:** The migration error path calls `prisma.$disconnect()` — this disconnects the **entire** Prisma client for the process, not just the failed query. Must be removed.

### Medium Priority — Scaling Concerns

#### 4. Verbose logging in `RedisSubscriberExtension`

`redisLogger.info` fires on every `pmessage` for loaded documents. With 10s save debounce across many documents, this creates significant log I/O.

**Fix:** Downgrade to `debug` level, or remove the per-message log entirely (the worker already logs saves).

#### 5. DB connection pool too small

`DB_POOL_SIZE` defaults to 5. A single Hocuspocus instance runs concurrent `fetch` (document load), history queries, and the BullMQ worker — all sharing the same pool.

**Fix:** Increase default to 10-15 for production. The BullMQ worker runs as `hocuspocus.worker.ts` (separate process) and imports its own `prisma` — verify it doesn't share the pool with the WS server at deploy time.

#### 6. BullMQ ignores queue Redis config

`queue.ts` uses `createRedisConnection` (main Redis config), not `createQueueRedisConnection` from the config that reads `REDIS_QUEUE_HOST`/`REDIS_QUEUE_PORT`. The split-Redis capability is dead code.

**Fix:** Switch `queue.ts` to use `createQueueRedisConnection`. This allows separating queue traffic from real-time collaboration Redis in production.

#### 7. `onListen` creates duplicate extension instances

`configureExtensions()` is called once in the main config and again inside `onListen` → `healthCheck.onConfigure`. The second call creates a new set of extension instances that aren't used by the server — wasted allocation and potentially misleading health checks.

**Fix:** Pass the existing extensions array to `onListen`, don't recreate.

### Already Good (No Action Needed)

- **Document saves are async** via BullMQ — not blocking the WebSocket thread
- **Save deduplication** with `jobId` time windows prevents save storms
- **Document views** are fire-and-forget Supabase RPCs — don't block connections
- **Health extension** is negligible (counter increment only)
- **Graceful shutdown** properly destroys server, disconnects Redis and DB
- **FOR UPDATE locking** on document version prevents race conditions

## Scope of Changes

| Item                                            | File                            | Effort      |
| ----------------------------------------------- | ------------------------------- | ----------- |
| 1. History pagination                           | `hocuspocus.server.ts`          | Small       |
| 2. `maxPayload`                                 | `hocuspocus.config.ts`          | Small       |
| 3a. Complete batch migration                    | Ops task (run script)           | Small       |
| 3b. Remove `prisma.$disconnect()` in error path | `hocuspocus.config.ts`          | Trivial     |
| 4. Log level fix                                | `redis-subscriber.extension.ts` | Trivial     |
| 5. DB pool size                                 | `.env` / `prisma.ts`            | Config only |
| 6. Queue Redis connection                       | `queue.ts`                      | Small       |
| 7. Duplicate extensions                         | `hocuspocus.config.ts`          | Small       |

## Research Sources

- [Hocuspocus — Server configuration](https://tiptap.dev/docs/hocuspocus/server/configuration)
- [Hocuspocus — Hooks (beforeHandleMessage, afterUnloadDocument)](https://tiptap.dev/docs/hocuspocus/server/hooks)
- [Hocuspocus — Scalability guide](https://tiptap.dev/docs/hocuspocus/guides/scalability)
- [Hocuspocus — Redis extension](https://tiptap.dev/docs/hocuspocus/server/extensions/redis)
- [Hocuspocus #1064 — maxPayload for oversized updates](https://github.com/ueberdosis/hocuspocus/issues/1064)
- [Hocuspocus #854 — Redis timer memory leak](https://github.com/ueberdosis/hocuspocus/issues/854)
- [Hocuspocus #845 — debounce/maxDebounce + multiplex](https://github.com/ueberdosis/hocuspocus/issues/845)
- [Hocuspocus #1034 — CPU creep / document unload](https://github.com/ueberdosis/hocuspocus/issues/1034)
- [Hocuspocus #709, #846 — document unload bugs](https://github.com/ueberdosis/hocuspocus/issues/709)
- [BullMQ — Worker concurrency](https://docs.bullmq.io/guide/workers/concurrency)
- [Yjs — Document updates API](https://docs.yjs.dev/api/document-updates)

## Next Steps

→ `/workflows:plan` for implementation details
