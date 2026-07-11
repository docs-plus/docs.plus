# docs.plus Backend API

> **Base URL (dev):** `http://localhost:4000`
> **Package:** `@docs.plus/hocuspocus`

The REST API runs from `src/index.ts` on a Hono app. This document covers the HTTP surface only. For the three-process architecture and environment variables, see [Readme.md](./Readme.md) and [ENV.md](./ENV.md). For the WebSocket protocol, see [WebSocket API](#websocket-api).

## Contents

1. [Authentication](#authentication)
2. [Response envelope](#response-envelope)
3. [Health](#health)
4. [Documents](#documents)
5. [Media](#media)
6. [Link metadata](#link-metadata)
7. [Email](#email)
8. [Admin](#admin)
9. [Push notifications](#push-notifications)
10. [Rate limiting](#rate-limiting)
11. [WebSocket API](#websocket-api)

## Authentication

Three schemes apply, by route group:

| Scheme                                | Used by                                                                                                                                                                                                | Header                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| None                                  | `/`, `/health/*`, `/api/plugins/hypermultimedia/*`, `/api/metadata`, `GET`/`POST /api/email/unsubscribe`                                                                                               | —                                                   |
| Optional Supabase user JWT            | `GET /api/documents` (list without `ownerId`), `GET /api/documents/:slug`, `PUT /api/documents/:docId`                                                                                                 | `token: <jwt>`                                      |
| Required Supabase user JWT            | `GET /api/documents?ownerId=…` / `?deleted=true`, `POST /api/documents`, document lifecycle (`DELETE /:id`, `/:id/restore`, `/:id/duplicate`, `/:id/permanent`, `POST /trash/purge`, `/trash/restore`) | `token: <jwt>`                                      |
| Supabase service-role key             | `/api/email/send-generic`, `/send-digest`, `/bounce`, `/preview/:type`                                                                                                                                 | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Supabase user JWT + `admin_users` row | `/api/admin/*`                                                                                                                                                                                         | `Authorization: Bearer <jwt>`                       |

> **`GET /api/documents/:slug` auth (shipped — owner-scoped private):** `optionalUser` attaches the caller. Public docs return full metadata to anyone; private docs are **owner-only** — anonymous or ownerless-private → `403 { access: 'sign-in-required' }`, signed-in non-owner → `403 { access: 'denied' }`. See the slug access matrix below.

Service-role checks use a constant-time compare (`src/api/utils/serviceRole.ts`). When `SUPABASE_SERVICE_ROLE_KEY` is unset, they fail closed in production and pass in non-production. Admin routes verify the JWT with Supabase, then require a matching row in `admin_users` (`src/api/middleware/adminAuth.ts`); failures return `401` (no/invalid token) or `403` (not an admin).

**List owner filter (shipped):** When `ownerId` is present on `GET /api/documents`, the caller must send a valid `token` header and `ownerId` must equal the JWT subject (`sub`). Missing token → `401`; mismatched `ownerId` → `403`.

**Unauthenticated fleet list:** `GET /api/documents` without `ownerId` returns **public rows only** — `isPrivate: true` rows are clamped out for any unverified caller or owner-less list (both the page query and its `total` count). This closes anonymous `?title=` enumeration of private titles/descriptions. Owner-scoped calls (`ownerId === token.sub`) are unaffected and still see the owner's private docs. The webapp Settings → Documents UI always sends `ownerId` + token and never uses the fleet path.

## Response envelope

The canonical error shape is defined by `getErrorResponse` in `src/lib/errors.ts`:

```json
{
  "success": false,
  "error": { "message": "Human-readable message", "code": "ERROR_CODE" }
}
```

`error.details` is included only when `NODE_ENV=development`. `AppError` subclasses map to status codes and codes: `VALIDATION_ERROR` (400), `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `UNPROCESSABLE_ENTITY` (422), `RATE_LIMIT_EXCEEDED` (429), `INTERNAL_SERVER_ERROR` (500), `SERVICE_UNAVAILABLE` (503), `DATABASE_ERROR`, `STORAGE_ERROR`. `handlePrismaError` maps Prisma codes (`P2002` → conflict, `P2025` → not found, etc.) into the same set.

The documents controller emits this envelope on error and `{ "success": true, "data": ... }` on success.

> **Known inconsistency — not yet wired globally.** Several handlers return ad-hoc shapes instead of the canonical envelope. Wiring `getErrorResponse` everywhere is a separate task. Until then expect these variants:
>
> - `{ "error": "..." }` — email handlers, admin middleware, media-upload guards, rate-limit middleware (which also returns `retryAfter`).
> - `{ "success": false, "code": "...", "message": "..." }` (note `code`/`message` at top level, not nested) — `/api/metadata`; its `code` is `INVALID_URL` or `BLOCKED_URL`.
> - Email `send-*` and `bounce` success bodies are `{ "success": true, ... }` with their own fields, not the `data` wrapper.

## Health

Health routes are exempt from rate limiting. Each returns `200` when healthy and `503` otherwise. Source: `src/api/routers/health.router.ts`, `src/api/services/health.service.ts`.

### GET /health

Aggregate check across database, Redis, and Supabase. Returns `degraded` (`503`) only when a critical service (database, or Redis when enabled) is unhealthy; Supabase may be down without failing the overall check.

```json
{
  "status": "ok",
  "timestamp": "2026-06-15T12:00:00.000Z",
  "services": {
    "database": { "status": "healthy", "lastCheck": "...", "metadata": { "pool": {} } },
    "redis": { "status": "healthy", "lastCheck": "...", "metadata": {} },
    "supabase": { "status": "healthy", "lastCheck": "..." }
  }
}
```

Per-service `status` is one of `healthy`, `unhealthy`, or `disabled` (Redis/Supabase when not configured).

### GET /health/database

Database connectivity (`SELECT 1`) plus pool metadata.

### GET /health/redis

Redis `PING`. `disabled` when Redis is not configured.

### GET /health/supabase

Supabase reachability. `disabled` when `SUPABASE_URL`/`SUPABASE_ANON_KEY` are unset.

### GET /health/push

Push gateway status. `200` when VAPID is configured and the queue is connected.

## Documents

Base path `/api/documents` (`src/api/routers/documents.router.ts`). Success responses use `{ "success": true, "data": ... }`.

### GET /api/documents

List or search documents. With any of `title`/`keywords`/`description`, runs a full-text search; otherwise lists all rows. Owner profiles (snake_case, mirroring `public.users`) are joined in.

| Param         | Type   | Default          | Description                                                                |
| ------------- | ------ | ---------------- | -------------------------------------------------------------------------- |
| `title`       | string | —                | Search term (tokenized)                                                    |
| `keywords`    | string | —                | Search term (tokenized)                                                    |
| `description` | string | —                | Search term (tokenized)                                                    |
| `ownerId`     | uuid   | —                | Filter by owner — **requires** `token` header; must match JWT `sub`        |
| `sort`        | string | `updatedAt_desc` | Allowlisted: `updatedAt_desc`, `createdAt_desc`, `title_asc`, `title_desc` |
| `limit`       | string | `10`             | Page size (1–100)                                                          |
| `offset`      | string | `0`              | Pagination offset (≥ 0)                                                    |

**Auth:** `optionalUser` on the route. When `ownerId` is set, missing or invalid token → `401`; `ownerId !== token.sub` → `403`. Without `ownerId`, no auth is required (fleet list — legacy).

List rows include `readOnly`, `isPrivate`, `createdAt`, and `updatedAt`.

**Sort:** Optional `sort` query param. Allowed values: `updatedAt_desc` (default), `createdAt_desc`, `title_asc`, `title_desc`. The server maps each key to a fixed, allowlisted Prisma `orderBy` (an unknown value falls back to `updatedAt_desc`). Required for the Settings → My Documents sort dropdown — client-side sort breaks paginated Load more.

**Private clamp:** Without a verified requester (`ownerId === token.sub`), private rows are excluded from both the results and `total` — see **Unauthenticated fleet list** above.

> **Semantic note:** `updatedAt` on `DocumentMetadata` reflects metadata changes (title, flags, keywords), not every collaborative body save. The UI label “Last modified” matches Google Docs parity.

```json
{
  "success": true,
  "data": {
    "docs": [
      /* ... */
    ],
    "total": 100
  }
}
```

### GET /api/documents/:docName

Fetch one document by slug. When no row matches, returns a synthesized draft (`createDraftDocument`) rather than `404`.

| Param    | Type           | Description                           |
| -------- | -------------- | ------------------------------------- |
| `userId` | string (query) | Optional; accepted for access context |

**Auth (shipped — owner-scoped private):** `optionalUser` attaches the caller (owner identity is `token.sub`, never the `userId` query param), and the controller applies:

| Document                 | Viewer                    | Result                                                                       |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Public                   | anyone                    | `200` — full metadata                                                        |
| Private                  | no token or anonymous JWT | `403` — `{ access: 'sign-in-required' }`                                     |
| Private                  | signed-in non-owner       | `403` — `{ access: 'denied' }`                                               |
| Private                  | owner (`sub === ownerId`) | `200` — full metadata                                                        |
| Private, `ownerId: null` | any signed-in user        | `403` — `{ access: 'sign-in-required' }` (sign-in wall until owner backfill) |

The `403` body is `{ success: false, error: { code: 'FORBIDDEN', message }, access }`; the top-level `access` hint drives the webapp private gate's CTA. Draft slugs (no DB row) are unchanged — synthesized draft, never treated as private.

### POST /api/documents

Create a document.

```json
{ "title": "My Document", "slug": "my-document", "description": "", "keywords": [] }
```

`title` and `slug` are required; `description` defaults to `""`, `keywords` to `[]`. The slug is normalized via `slugify`; a 19-char `documentId` is generated.

### PUT /api/documents/:docId

Upsert document metadata by `documentId`. All fields optional: `title`, `description`, `keywords` (`string[]`), `readOnly` (`boolean`, **owner-only**), `isPrivate` (`boolean`, **owner-only**). Non-owners may update collaborative fields; `readOnly` / `isPrivate` changes from non-owners are silently ignored (logged server-side).

### DELETE /api/documents/:documentId

Soft-delete (owner-only, `requireUser`). Stamps `deletedAt`; the row survives for restore and is reaped after `DOC_DELETE_RETENTION_DAYS` (default 30). Idempotent — a missing row returns success. Non-owner → `403`.

### POST /api/documents/:documentId/restore

Clear `deletedAt` (owner-only). Idempotent; non-owner → `403`.

### POST /api/documents/:documentId/duplicate

Copy the source's latest Yjs bytes into a fresh owner-owned doc (owner-only). Slug is `<title> (copy)`, uniquified. Media is shared, not cloned. Non-owner → `403`; soft-deleted source → `404`.

### DELETE /api/documents/:documentId/permanent

Purge a soft-deleted doc's full footprint (owner-only) — chat and views via the `purge_document_footprint` Supabase RPC, editor media via a storage-prefix delete, then the metadata row. Refuses a live doc → `400`. Idempotent (already-gone → success). Shares the reaper's purge path.

### GET /api/documents?deleted=true

The caller's own soft-deleted docs (Trash), newest-tombstone-first. `requireUser`; owner-scoped to `token.sub` (never a client `ownerId`). Same page shape as the list.

### POST /api/documents/trash/purge

Bulk permanent-delete (owner-only). Body `{ ids?: string[] }` — omit `ids` to empty the whole trash, or pass a selection (capped at 500). Returns `{ purged: <count> }`. Runs the per-doc purge sequentially; synchronous, so a very large trash can exceed the request timeout (small in practice — the reaper bounds growth).

### POST /api/documents/trash/restore

Bulk restore (owner-only). Body `{ ids: string[] }` (1–500). Returns `{ restored: <count> }`. Non-owned ids are skipped.

## Media

Base path `/api/plugins/hypermultimedia` (`src/api/routers/hypermultimedia.router.ts`). Backs the editor's hypermultimedia extension. Storage targets local disk when `PERSIST_TO_LOCAL_STORAGE=true`, otherwise S3-compatible (DigitalOcean Spaces).

### POST /api/plugins/hypermultimedia/:documentId

Upload one media file. Body is `multipart/form-data` with field name **`mediaFile`** (not `file`).

Allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `video/mp4`, `video/webm`, `video/ogg`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `application/pdf`. Max size is `DO_STORAGE_MAX_FILE_SIZE` (default 10 MB; see [ENV.md](./ENV.md)).

Returns `201`. Shape depends on the backend (`type: "s3"` or local), including `fileType`, `fileName`, and `fileAddress`. Oversized files return `413` (`PAYLOAD_TOO_LARGE`); disallowed types return `415` (`UNSUPPORTED_MEDIA_TYPE`).

### GET /api/plugins/hypermultimedia/:documentId/:mediaId

Stream a media file with its `Content-Type`.

## Link metadata

Base path `/api/metadata` (self-contained module at `src/modules/link-metadata`). Unfurls a URL through a cache → oEmbed → special-handler → HTML-scrape pipeline with SSRF protection.

### GET /api/metadata?url=<http(s) url>

`url` is required, must be http(s), and ≤ 2048 chars. Honors `Accept-Language`.

Success (`200`) returns the `MetadataResponse` contract from `src/modules/link-metadata/domain/types.ts` — `success: true`, `url`, `requested_url`, `title`, optional `description`/`image`/`author`/`publisher`/`oembed`/etc., plus `cached` and `fetched_at`. Responses set `Cache-Control` (positive cache for hits, short negative cache for fallbacks) and `Vary: Accept-Language`.

Errors (`400`) use this module's own shape — top-level `code` and `message`, not the nested envelope:

```json
{ "success": false, "code": "INVALID_URL", "message": "..." }
```

`code` is `INVALID_URL` or `BLOCKED_URL` (SSRF guard).

## Email

Base path `/api/email` (`src/api/email.ts`). Notification delivery runs through a pgmq consumer, not HTTP: `email_queue` → `pg_cron` → pgmq → worker → BullMQ → SMTP. **The `/api/email/send` endpoint was removed.** The endpoints below are internal triggers and webhooks; all except `unsubscribe` require the service-role key.

### POST /api/email/send-generic

Send one email directly. Body: `to`, `subject`, `html`, optional `text`, `replyTo` (validated by `sendGenericEmailSchema`). Returns `{ "success": true, "message_id": "..." }`.

### POST /api/email/send-digest

Send a daily/weekly digest. Body: `to`, `frequency`, `documents[]`, optional `user_name` (`sendDigestEmailSchema`).

### POST /api/email/bounce

Record a provider bounce event. Body: `email`, `bounce_type`, optional `provider`, `reason`. Hard bounces auto-suppress the user; returns `{ "success": true, "bounce_id": ..., "auto_suppressed": <bool> }`.

### GET /api/email/health

Email gateway health (no auth).

### GET /api/email/status

`{ "operational": <bool>, "timestamp": "..." }` (no auth).

### GET /api/email/preview/:type

Render a template (`notification` or `digest`) with sample data, as HTML. Service-role only.

### GET /api/email/unsubscribe?token=

One-click unsubscribe from an email link. No auth (the token is the credential). Verifies the token via the `process_unsubscribe` Supabase RPC and returns an HTML confirmation page.

### POST /api/email/unsubscribe?token=

RFC 8058 `List-Unsubscribe-Post` handler for mail clients. Returns JSON (`{ "success": true }` or an `{ "error": ... }` body).

## Admin

Base path `/api/admin` (`src/api/routers/admin.router.ts`). Every route requires a valid Supabase JWT for a user present in `admin_users`. Endpoints below are grouped as in the router.

**Dashboard & users**

| Method | Path                      | Purpose                  |
| ------ | ------------------------- | ------------------------ |
| GET    | `/stats`                  | Dashboard overview stats |
| GET    | `/users/document-counts`  | Document count per user  |
| GET    | `/users/admins`           | All admin user IDs       |
| POST   | `/users/:id/toggle-admin` | Grant or revoke admin    |

**Documents**

| Method | Path                             | Purpose                                 |
| ------ | -------------------------------- | --------------------------------------- |
| GET    | `/documents`                     | List documents (paginated)              |
| GET    | `/documents/stats`               | Document statistics                     |
| PATCH  | `/documents/:id`                 | Update document flags                   |
| GET    | `/documents/:id/deletion-impact` | Preview deletion cascade                |
| DELETE | `/documents/:id`                 | Delete (requires `confirmSlug` in body) |
| GET    | `/documents/:slug/views`         | View stats for one document             |
| GET    | `/documents/:slug/preview`       | Content preview                         |

**View analytics**

| Method | Path                        | Purpose                       |
| ------ | --------------------------- | ----------------------------- |
| GET    | `/stats/views`              | Overall view summary          |
| GET    | `/stats/views/top`          | Top viewed documents          |
| GET    | `/stats/views/trend`        | View trend series             |
| GET    | `/stats/views/batch-trends` | Per-document sparkline trends |

**Retention & activity**

| Method | Path                          | Purpose                      |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/stats/retention`            | DAU/WAU/MAU                  |
| GET    | `/stats/user-lifecycle`       | Lifecycle segments           |
| GET    | `/stats/dau-trend`            | Daily active users trend     |
| GET    | `/stats/activity-heatmap`     | Activity by hour             |
| GET    | `/stats/top-active-documents` | Most active by message count |
| GET    | `/stats/communication`        | Communication stats          |
| GET    | `/stats/notification-reach`   | Notification delivery stats  |

**Stale documents audit**

| Method | Path                           | Purpose              |
| ------ | ------------------------------ | -------------------- |
| GET    | `/documents/stale/summary`     | Stale summary        |
| GET    | `/documents/stale`             | List stale documents |
| POST   | `/documents/stale/bulk-delete` | Bulk delete stale    |

**Notification audit**

| Method | Path                                        | Purpose                        |
| ------ | ------------------------------------------- | ------------------------------ |
| GET    | `/audit/notifications/health`               | Combined health score          |
| GET    | `/audit/notifications/push-failures`        | Push failure breakdown         |
| GET    | `/audit/notifications/email-failures`       | Email failure/bounce breakdown |
| GET    | `/audit/notifications/failed-subscriptions` | Failed push subscriptions      |
| GET    | `/audit/notifications/email-bounces`        | Bounce list                    |
| POST   | `/audit/notifications/disable-failed`       | Disable dead subscriptions     |
| GET    | `/audit/notifications/dlq`                  | BullMQ dead-letter contents    |

**Ghost accounts audit**

| Method | Path                                        | Purpose                   |
| ------ | ------------------------------------------- | ------------------------- |
| GET    | `/audit/ghost-accounts`                     | List ghost accounts       |
| GET    | `/audit/ghost-accounts/summary`             | Category summary          |
| GET    | `/audit/ghost-accounts/:id/impact`          | FK dependency check       |
| DELETE | `/audit/ghost-accounts/:id`                 | Smart-delete one          |
| POST   | `/audit/ghost-accounts/bulk-delete`         | Bulk delete (max 50)      |
| POST   | `/audit/ghost-accounts/resend-confirmation` | Resend magic link         |
| POST   | `/audit/ghost-accounts/cleanup-anonymous`   | Clean stale anon sessions |

## Push notifications

There is **no HTTP push endpoint** — `/api/push` was removed. Push delivery runs through pgmq the same way email does: a Supabase trigger enqueues to pgmq, the worker polls it and delivers via BullMQ and the Web Push API. Devices register through Supabase RPCs:

```javascript
await supabase.rpc('register_push_subscription', {
  p_device_id: 'unique-device-id',
  p_device_name: 'Chrome on MacBook',
  p_platform: 'web',
  p_push_credentials: { endpoint: '...', keys: { p256dh: '...', auth: '...' } }
})

await supabase.rpc('unregister_push_subscription', { p_device_id: 'unique-device-id' })
```

`GET /health/push` reports gateway status.

## Rate limiting

A global limiter (`src/middleware/index.ts`) applies to every non-`OPTIONS` request except `/health` and `/health/*`. It is keyed on client IP + User-Agent and backed by Redis; **when Redis is unavailable, rate limiting is disabled** (requests pass). Requests with no `x-forwarded-for` and no `x-real-ip` (direct/internal traffic) skip the limiter.

The single limit is `RATE_LIMIT_MAX` requests (default `100`) per 15-minute window. There is no separate per-role tier in the REST middleware.

Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (ISO timestamp). On `429`, the body is `{ "error": "...", "retryAfter": <seconds> }` and a `Retry-After` header is set.

## WebSocket API

The collaboration server (`src/hocuspocus.server.ts`, default port `4001`) speaks the Hocuspocus protocol over Y.js. Connections authenticate with a JWT passed in the Hocuspocus `token` field (JSON with `accessToken`, `slug`, `deviceType`).

```javascript
import { HocuspocusProvider } from '@hocuspocus/provider'

const provider = new HocuspocusProvider({
  url: 'ws://localhost:4001',
  name: 'document-slug',
  token: JSON.stringify({ accessToken, slug, deviceType: 'desktop' })
})
```

The document `name` is the room id (Prisma `documentId`); the server never trusts a client-supplied id in the token for authorization.

### Private documents

**Breaking change (shipped):** `isPrivate` now allows the **owner only** (`user.sub === ownerId`). Anonymous and signed-in non-owners are rejected — previously any signed-in (non-anonymous) user could connect. Ownerless-private rooms (`ownerId: null`) reject everyone until owner backfill. When the metadata lookup **fails**, the server can no longer determine privacy, so it **fails closed** (rejects) instead of admitting the connection as public; a successful public-doc lookup still connects without auth. The decision is a pure resolver (`src/lib/wsAccess.ts`) with a matrix unit test.

**Read-only:** When `readOnly` is true and the connector is not the owner, the connection is marked read-only on the write path (existing behavior).

See the [Hocuspocus documentation](https://tiptap.dev/hocuspocus/introduction) for the wire protocol.
