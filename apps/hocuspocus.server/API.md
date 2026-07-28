# docs.plus Backend API

> **Base URL (dev):** `http://localhost:4000`
> **Package:** `@docs.plus/hocuspocus`

The REST API runs from `src/index.ts` on a Hono app. This document covers the HTTP surface only. For the three-process architecture and environment variables, see [Readme.md](./Readme.md) and [ENV.md](./ENV.md). For the WebSocket protocol, see [WebSocket API](#websocket-api).

**Machine-readable spec.** The same surface is published as OpenAPI 3.1 at `GET /openapi.json`, with Swagger UI at `GET /docs` (`src/modules/openapi/`), the [document version](#document-versions) routes excepted. Request schemas are generated from the live zod schemas, so they cannot drift from validation. Traefik routes only `/api` and `/health`, so both paths are reachable in local and internal environments but **not** on the public edge — publishing them is a routing decision, not a code change.

## Contents

1. [Authentication](#authentication)
2. [Response envelope](#response-envelope)
3. [Health](#health)
4. [Documents](#documents)
5. [Document content](#document-content)
6. [Document versions](#document-versions)
7. [Document conversion](#document-conversion)
8. [Media](#media)
9. [Link metadata](#link-metadata)
10. [Email](#email)
11. [Admin](#admin)
12. [Push notifications](#push-notifications)
13. [Rate limiting](#rate-limiting)
14. [WebSocket API](#websocket-api)

## Authentication

Three schemes apply, by route group:

| Scheme                                | Used by                                                                                                                                                                                                                                    | Header                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| None                                  | `/`, `/health/*`, `/openapi.json`, `/docs`, `GET /api/plugins/hypermultimedia/:documentId/:mediaId`, `/api/metadata`, `GET`/`POST /api/email/unsubscribe`                                                                                  | —                                                   |
| Optional Supabase user JWT            | `GET /api/documents` (list without `ownerId`), `GET /api/documents/:slug`, `PUT /api/documents/:docId`                                                                                                                                     | `token: <jwt>`                                      |
| Required Supabase user JWT            | `GET /api/documents?ownerId=…` / `?deleted=true`, `POST /api/documents`, document lifecycle (`DELETE /:id`, `/:id/restore`, `/:id/duplicate`, `/:id/permanent`, `POST /trash/purge`, `/trash/restore`)                                     | `token: <jwt>`                                      |
| Either of the two above               | `GET /api/documents/:documentId/export`, `POST /api/documents/:documentId/import` — the key passes every document, a user token is checked against the document's privacy and lock                                                         | `token: <jwt>` or the service-role bearer           |
| Supabase service-role key             | `/api/email/send-generic`, `/send-digest`, `/bounce`, `/preview/:type`, `GET`/`PATCH /api/documents/:documentId/content`, every `/api/documents/:documentId/versions` route, and the `content` / `ownerId` fields on `POST /api/documents` | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Supabase user JWT + `admin_users` row | `/api/admin/*`                                                                                                                                                                                                                             | `Authorization: Bearer <jwt>`                       |

> **`GET /api/documents/:slug` auth (shipped — owner-scoped private):** `optionalUser` attaches the caller. Public docs return full metadata to anyone; private docs are **owner-only** — anonymous or ownerless-private → `403 { access: 'sign-in-required' }`, signed-in non-owner → `403 { access: 'denied' }`. See the slug access matrix below.

Service-role checks use a constant-time compare (`verifyServiceRole` in `src/lib/auth.ts`). When `SUPABASE_SERVICE_ROLE_KEY` is unset they fail closed in **every** environment, non-production included. Admin routes verify the JWT with Supabase, then require a matching row in `admin_users` (`src/api/middleware/adminAuth.ts`); failures return `401` (no/invalid token) or `403` (not an admin).

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
    "docs": [/* ... */],
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

Two further fields are accepted **only** under the service-role key: `content` (a Tiptap JSON document, seeded as version 1) and `ownerId` (a bare Supabase uid). A user JWT presenting either gets `403 FORBIDDEN` and nothing is written. See [Create with content](#create-with-content). Without them, behavior is unchanged for user-JWT callers.

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

## Document content

Read and write a document's body from a server-side integration. Writes reach live collaborators in real time: the REST process forwards them to the collaboration process, which applies them to the in-memory Y.Doc through the same pipeline a browser edit uses. Module: `src/modules/document-content/`.

All three surfaces are service-role only (`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`). A user JWT gets `401`.

### Identifying a document

Content routes address documents by **`documentId`** — the 19-character id that is also the collaboration room name and the snapshot key. Never by slug: the slug read never 404s, it synthesizes a draft and mints a fresh `documentId` on every call, so an automation trusting it would address a room no client will ever join.

Resolve a slug once with `GET /api/documents/:docName` and keep the `documentId` from the response. A synthesized draft carries no `id` or `createdAt` — that absence is how you detect a mistyped slug.

**Private documents are not discoverable this way.** The slug read enforces the owner-only private gate and does not honor the service-role key, and `GET /api/documents?ownerId=` needs that owner's JWT. Capture `documentId` from the create response; for a pre-existing private document it has to come out of band (the owner's own slug read, or an operator reading `DocumentMetadata`).

### Content contract

- **Documents are title-first.** The first node must be a level-1 `heading`. A heading-less `replace` or create payload is rejected with `422`; the editor would otherwise synthesize a title on first open and persist a heading you never wrote.
- **Image nodes are inline.** Wrap them in a `paragraph` or `heading`. A top-level `image` is `422`.
- **Headings and tables carry a `toc-id`.** The server assigns one where it is missing or duplicated within the payload. That id is the identity a heading's chat thread, fold state, and `?id=` deep link hang off — round-trip the toc-ids from `GET` through a `replace` to keep them stable.
- **Unregistered attributes are dropped at encode.** ProseMirror keeps only attributes the server's extension set declares; anything else is discarded silently. `GET` returns what was stored, not what was sent.
- **The first editable browser open may normalize the document**, so a `GET` after someone opens it can differ from what you wrote.

### GET /api/documents/:documentId/content

Reads the persisted head snapshot. Query: `format` = `json` (default) or `text`.

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "version": 12,
    "format": "json",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 1, "toc-id": "a1B2c3D4e5F6g7H8" },
          "content": [{ "type": "text", "text": "Quarterly report" }]
        }
      ]
    }
  }
}
```

`format=text` returns block text, one line per textblock:

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "version": 12,
    "format": "text",
    "content": "Quarterly report\nRevenue grew 12%."
  }
}
```

A document with metadata but no snapshot row yet returns `version: 0` with `{ "type": "doc", "content": [] }` (or `""` for text) — not an error.

**Staleness.** This is the persisted head, so it can trail a document people are actively editing by the store debounce — 10 s idle, 60 s maximum. There is no live read.

**Trust boundary.** Content is stored and returned verbatim; the server never sanitizes it. docs.plus renders it safely through its extension render gates plus CSP, but a consumer rendering this JSON with its own renderer must apply its own URL-scheme allowlist.

### PATCH /api/documents/:documentId/content

Applies content to the document. Query: `mode` = `replace` (default) or `append`.

```json
{
  "content": {
    "type": "doc",
    "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Appended by automation." }] }
    ]
  }
}
```

| Field           | Type            | Description                                                                 |
| --------------- | --------------- | --------------------------------------------------------------------------- |
| `content`       | Tiptap doc JSON | Required. `{ "type": "doc", "content": [...] }` with at least one node      |
| `commitMessage` | string          | Optional, trimmed, 1–200 characters. Names the version row this write mints |

`replace` swaps the whole body; `append` adds the payload's top-level nodes after the existing ones. Appending into an empty document makes the payload the document's first node, so the title-first rule applies there too.

**Naming a write is permanent history.** A `commitMessage` becomes the version row's name, and autosave retention never thins a named row — see [Document versions](#document-versions). Name the writes a person would want to find again, and leave a bulk import's chunks unnamed: a named 500-chunk run leaves 500 rows nothing will ever prune.

Live and cold documents take the same path. If collaborators have the document open, they see the change immediately without reconnecting. If nobody has it open, it loads, applies, persists, and unloads.

**Clearing a document** is `replace` with a single empty level-1 heading: `[{ "type": "heading", "attrs": { "level": 1 } }]`. The applier also clears the editor's `needsInitialization` flag, which is what stops the starter template from overwriting that particular payload on first open.

**Concurrency** is CRDT last-writer-wins; there is no checksum or `If-Match` guard. Across replicas, `replace` guarantees removal of _persisted_ content — concurrent unsynced edits on another replica may survive as a union or be superseded by CRDT order. Both are safe; neither corrupts.

**Retries.** `replace` is idempotent. `append` is at-least-once under a `503` or timeout — `GET` and verify before retrying one. A single persist-failed `500` is retriable with `mode=replace`. A _repeated_ persist-failed `500` for the same document means server-side persistence is wedged for it until the collaboration process restarts: stop retrying and alert an operator, because further attempts keep mutating and broadcasting to live clients while never persisting. The operator signal is `document_content_apply_total{outcome="error"}` on the collaboration process's metrics endpoint.

**Batching imports.** Every `PATCH` persists a full document version. Prefer one `replace` or a few large appends over many small ones: a 500-chunk import stores roughly 500 cumulative snapshots, which survive until autosave retention thins unnamed versions to one per document per day (`DOC_AUTOSAVE_RETENTION_DAYS`). Many small appends also run into the global rate limiter.

### Create with content

`POST /api/documents` with `content` (service-role only) encodes first, then writes the metadata row and version 1 in one transaction — an invalid payload leaves zero rows behind. `ownerId` sets the owner; `isPrivate` is not accepted. The first visitor renders the injected content rather than the starter template. A taken slug conflicts with `409` instead of being silently renamed.

### Status codes

| Status | Code                    | When                                                                                                                                                                                                        |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Malformed `documentId`, unknown `format` or `mode`, or a body that is not a non-empty Tiptap doc                                                                                                            |
| `401`  | `UNAUTHORIZED`          | Missing, wrong, or user-JWT bearer; also when `SUPABASE_SERVICE_ROLE_KEY` is unset (fails closed)                                                                                                           |
| `403`  | `FORBIDDEN`             | `content` or `ownerId` on `POST` without the service-role key                                                                                                                                               |
| `404`  | `NOT_FOUND`             | No metadata row, or the document is soft-deleted. `PATCH` never creates — use `POST`                                                                                                                        |
| `409`  | `CONFLICT`              | `POST` slug already taken                                                                                                                                                                                   |
| `413`  | `PAYLOAD_TOO_LARGE`     | Body over 5 MiB, on `PATCH` and `POST` alike                                                                                                                                                                |
| `422`  | `UNPROCESSABLE_ENTITY`  | Unknown node or mark, a content-expression violation, a missing level-1 title heading, or over 50 000 nodes / 100 levels of nesting. Nothing is written                                                     |
| `429`  | —                       | Global rate limiter. Body is `{ "error": "...", "retryAfter": <seconds> }`, not the house envelope — see [Rate limiting](#rate-limiting)                                                                    |
| `500`  | `INTERNAL_SERVER_ERROR` | Snapshot decode failure on `GET`; persist failure on `PATCH` (see the durability contract); or the REST and collaboration processes holding different service-role keys, which the message names explicitly |
| `503`  | `SERVICE_UNAVAILABLE`   | The collaboration process is unreachable or did not answer within 30 s                                                                                                                                      |

### Access semantics under the service key

| Document state  | GET   | PATCH                                                                |
| --------------- | ----- | -------------------------------------------------------------------- |
| Public          | `200` | `200`                                                                |
| Private         | `200` | `200` — the service key is the admin plane; user gates are untouched |
| Read-only       | `200` | `200` — the read-only lock keeps blocking non-owner _users_          |
| Soft-deleted    | `404` | `404`                                                                |
| No metadata row | `404` | `404`                                                                |

### Durability contract

A `PATCH 200` means the change was applied to the document, broadcast to any live collaborators, and pushed into the normal store pipeline. It does not certify a committed database row:

- In production the immediate store can lose the cross-replica lock to a peer and abort silently. The release flush and any later client-driven store heal it — the same crash window normal collaborative edits have.
- For a cold document, `200` means durably enqueued. A worker outage longer than the claim-check TTL is a pre-existing platform gap.

A `500` with the persist-failed message means the change may already be visible to live clients but did not persist.

### Security posture

Content surfaces sit behind the constant-time, fail-closed service-role check; the caps and guards below are availability and hygiene, not access control.

- 5 MiB per content-bearing request body, enforced before parse.
- 50 000 nodes and 100 levels of nesting, enforced before the payload reaches the Yjs transformer. Node count, not bytes, is what bounds encode cost.
- `documentId` is shape-checked against the 19-character alphanumeric id format before any database round-trip or internal hop.
- No server-side content sanitizer, deliberately: it is dead defense against a service-role caller. Stored-content XSS is handled at render time by the extension gates and CSP — see the trust boundary above.

### Internal apply endpoint

`POST /internal/documents/:documentId/content` on the collaboration process's internal listener (port `HOCUSPOCUS_INTERNAL_HTTP_PORT`, default `4003`, shared with `/metrics`). Not Traefik-routed and not reachable from the public edge. REST forwards to it over `HOCUSPOCUS_INTERNAL_URL` with the same service-role bearer and the caller's `x-request-id`. Deploy `hocuspocus-server` before `rest-api` whenever this wire shape changes.

## Document versions

Read, compare, name, delete, and restore a document's history. Module: `src/modules/document-versions/`.

| Route                                                       | Does                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/documents/:documentId/versions`                   | List the history, newest first                        |
| `POST /api/documents/:documentId/versions`                  | Name the next stored version — a checkpoint           |
| `GET /api/documents/:documentId/versions/:version`          | Read one version's content                            |
| `GET /api/documents/:documentId/versions/:version/diff`     | Compare a version with an earlier one, block by block |
| `DELETE /api/documents/:documentId/versions/:version`       | Delete one version, as long as it is not the newest   |
| `POST /api/documents/:documentId/versions/:version/restore` | Put a version's content back into the live document   |

All six are service-role only (`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`); a user JWT gets `401`. They address documents by `documentId`, never by slug — see [Identifying a document](#identifying-a-document). They are not published in `/openapi.json`.

Reads and the delete run straight off Postgres in the REST process. The checkpoint and the restore need the live Y.Doc, so REST forwards them to the collaboration process over the same internal hop the content applier uses.

### Every save is already a version

The collaboration server persists a full snapshot per debounced save — 10 s after typing stops, 60 s at the latest — so rows accumulate whether or not anyone asks for them. There is no versioning schedule to configure: that debounce envelope is the granularity, and it is the same window the [content read](#get-apidocumentsdocumentidcontent) can trail by.

A checkpoint therefore creates no history that would otherwise be missing. What it adds is a **name**, and the name is what the retention sweep keys off: unnamed rows older than `DOC_AUTOSAVE_RETENTION_DAYS` (default 30) are thinned to one per document per day, while a row named by a person is never pruned. Spend names on the moments a person would want to find again.

Names the server mints for itself are the exception — see [`trigger`](#get-apidocumentsdocumentidversions). They read like any other named row but the sweep thins them, so a restore older than the retention window stops being undoable.

Snapshots are cumulative full state, not deltas, so deleting or pruning an old row never damages a newer one.

### GET /api/documents/:documentId/versions

Metadata for the document's versions, newest first. No snapshot bytes — read those one version at a time.

| Param    | Type | Default | Description       |
| -------- | ---- | ------- | ----------------- |
| `limit`  | int  | `50`    | Page size, 1–100  |
| `offset` | int  | `0`     | Rows to skip, ≥ 0 |

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "versions": [
      {
        "version": 14,
        "name": "Before the board review",
        "trigger": "checkpoint",
        "triggeredBy": null,
        "contributors": [],
        "createdAt": "2026-07-25T14:02:11.301Z"
      },
      {
        "version": 13,
        "name": null,
        "trigger": "websocket",
        "triggeredBy": {
          "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
          "avatar_url": "https://example.test/ada.png",
          "avatar_updated_at": "2026-07-01T09:12:00.000Z",
          "full_name": "Ada Lovelace",
          "display_name": "Ada",
          "status": "online"
        },
        "contributors": [],
        "createdAt": "2026-07-25T13:58:40.117Z"
      }
    ],
    "total": 14,
    "limit": 50,
    "offset": 0
  }
}
```

`total` counts every row for the document and is read in the same transaction as the page, so it cannot describe a different history than the rows beside it.

| Field          | Meaning                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | Monotonic per document, starting at 1. Gaps are normal — retention and `DELETE` both leave them                                                           |
| `name`         | The row's commit message, or `null` for an unnamed autosave                                                                                               |
| `trigger`      | What caused the row: `websocket`, `api`, `checkpoint`, `revert`, `revert-backup`, `schema-migration`, or `null` on rows stored before attribution shipped |
| `triggeredBy`  | Profile of whoever caused the row, or `null`                                                                                                              |
| `contributors` | Profiles of everyone whose edits landed in this row                                                                                                       |
| `createdAt`    | Commit time of the row, not of the edits inside it                                                                                                        |

Profiles are the `public.users` columns the history sidebar renders, snake_case as that table spells them. Attribution is decoration: when the profile lookup fails, `triggeredBy` falls back to `null` and unresolvable ids drop out of `contributors` rather than failing the request. An id that resolves to no profile disappears the same way.

`triggeredBy` on a `websocket` row is the collaborator whose edit flushed the debounce window; on a `checkpoint` or `revert` row it is whoever asked for the operation. Both REST write routes leave it `null` — the service key is nobody, and only the editor's own in-app revert carries a real account.

`contributors` is best-effort and per-replica: it is the set of accounts whose updates reached **this** collaboration replica since its previous save, so a room split across replicas records each replica's own set. Anonymous editors are stored in the column — they carry a Supabase `sub` like anyone else — but resolve to no profile and so never appear in the rendered list. Read the column's length as a floor on the rendered one, never as its equal.

The server names some rows itself, and their `trigger` is what tells them apart from a name a person typed. `Before restore of version N` carries `revert-backup` and `Schema migration` carries `schema-migration`; both list like any other named version, but retention thins them once they pass the window. `Restored version N` carries `revert` — a person asked for it, so it survives retention like a checkpoint.

### POST /api/documents/:documentId/versions

Names the next stored version.

```json
{ "name": "Before the board review" }
```

`name` is required, trimmed, and 1–200 characters. The document's body is untouched: the checkpoint opens the document, commits an empty transaction to trigger one immediate save, and lets that save carry the name.

```json
{
  "success": true,
  "data": { "documentId": "kR4pZ2mQ7tY1nB8xW3v", "name": "Before the board review" }
}
```

**A `200` means the save pipeline was triggered, not that a row exists.** The row is written by the worker; when its transaction commits, the worker publishes `doc:<documentId>:saved` on Redis and the collaboration process re-broadcasts it into the room as a `document:saved` stateless message. That broadcast is the signal the row landed. A REST caller gets no such push — poll `GET …/versions` for the name if you need certainty.

One gap to know about: when the enqueue fails and the collaboration process falls back to saving directly to Postgres, the row still lands but nothing publishes `doc:*:saved`, so the room never sees a confirmation for it. That is pre-existing behavior of the fallback, not specific to checkpoints.

**A checkpoint always lands, even when the bytes have not changed.** The store pipeline deduplicates saves of identical content within a ten-second window, so a checkpoint taken right after an autosave would otherwise be swallowed by it and lose the name. A checkpoint widens its own job id with a random key to stay off that dedupe, which means naming an unchanged document produces a named row whose content duplicates the row before it. That is the intent — the name is the point.

### GET /api/documents/:documentId/versions/:version

One version's content, through the same decoder as [`GET /content`](#get-apidocumentsdocumentidcontent). Query: `format` = `json` (default) or `text`.

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "version": 13,
    "format": "json",
    "content": { "type": "doc", "content": [] }
  }
}
```

The same [trust boundary](#get-apidocumentsdocumentidcontent) applies: stored content is returned verbatim and the server never sanitizes it.

### GET /api/documents/:documentId/versions/:version/diff

Which top-level blocks differ between two versions, and whose text sits in them now. `:version` is the newer side.

| Param  | Type | Default                   | Description                      |
| ------ | ---- | ------------------------- | -------------------------------- |
| `base` | int  | the nearest version below | The older side of the comparison |

The default is the greatest version below `:version`, which is not always `:version - 1` — retention and `DELETE` leave gaps. A `base` at or above `:version` is a `400`, and that check runs before the document is looked up — so it answers `400` rather than `404` even for a document that does not exist. A `base` naming a version that does not exist is a `404`; an omitted `base` on a document's oldest version is not, and comes back as `fromVersion: 0` with the whole document read as `added`.

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "fromVersion": 16,
    "toVersion": 17,
    "blocksBefore": 269,
    "blocksAfter": 269,
    "changes": [
      {
        "kind": "changed",
        "index": 65,
        "nodeType": "taskList",
        "from": 9610,
        "to": 11033,
        "before": "Capture the goal\nDraft the first pass",
        "after": "Capture the goal\nDraft the second pass",
        "clientIds": [3728007124]
      }
    ],
    "totalChanges": 4,
    "coarse": false,
    "unattributed": false,
    "authors": []
  }
}
```

| Field                          | Meaning                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `fromVersion`                  | The older side. `0` when the newer version has no predecessor                                                                  |
| `blocksBefore` / `blocksAfter` | Top-level block counts on each side                                                                                            |
| `changes`                      | `added`, `removed`, and `changed` blocks, in the newer document's order, capped at 500 entries                                 |
| `totalChanges`                 | The true count before the cap. `changes.length < totalChanges` means the list was clipped                                      |
| `coarse`                       | Matching hit its cell budget and fell back to remove-all plus add-all. Positions and previews still hold, the pairing does not |
| `unattributed`                 | The stored Yjs items did not line up with the decoded blocks, so every `clientIds` is empty                                    |

Each entry in `changes` carries `index`, the top-level index in the newer document — in the older one on `removed`. `from` and `to` are ProseMirror positions in the newer document, absent on `removed`. `before` and `after` are the first 200 characters of the block's text.

Comparison is over whole top-level blocks of decoded ProseMirror content, not over words, so a one-word edit reports the paragraph. Editor-regenerated `toc-id` attributes are stripped first: re-anchoring a heading is not a change.

**Authorship.** `clientIds` lists the Yjs clientIDs holding live content in the block, and `authors` names them — one entry per clientID that has a binding row.

```json
{ "clientId": 3728007124, "user": { "id": "1b9d…", "display_name": "Ada" }, "anonymous": false }
```

`user` carries the same [`public.users` columns](#get-apidocumentsdocumentidversions) the history sidebar renders, or `null` when the binding exists but no profile resolved. `anonymous` records that the account was anonymous when the clientID was bound; identity is joined at read time, so an anonymous editor who later signs up gets their real name here across their whole history, with no backfill.

A clientID that appears in `changes[].clientIds` but not in `authors` is unattributed. Bindings exist only for edits made after attribution capture shipped, so on an older document `authors` is `[]` while `clientIds` stays populated — that is how a caller tells "unknown writer" apart from "nobody attributed".

**The diff answers who wrote the text currently in this block. It does not answer who made this change, and it does not answer who deleted this.** `removed` blocks carry no authorship at all: the collaboration server runs Yjs garbage collection, which erases deleted items, so nothing survives to name whoever removed them.

**clientID bindings are a first-claim record, not an audit trail.** Yjs clientIDs are asserted by the client. The server records the account that first claimed one on a live socket and never overwrites it, so a legitimate editor cannot be displaced by a later forger — but the row is not proof of authorship, and nothing built on it should imply that it is.

**Identical versions.** A checkpoint of an unchanged document mints a named row whose content duplicates the row before it. Diffing that pair returns `200` with `changes: []` and both block counts `0`: the bytes are compared without decoding either side, so the counts are never taken. Zero here means not counted, not empty.

Neither `503` nor `413` can come back from this route. It reads straight off Postgres and never touches the collaboration process, and a `GET` carries no body to overrun.

### DELETE /api/documents/:documentId/versions/:version

Deletes one version permanently.

```json
{ "success": true, "data": { "documentId": "kR4pZ2mQ7tY1nB8xW3v", "version": 7, "deleted": true } }
```

**The newest version cannot be deleted** — `409 CONFLICT`. It is the base a cold load reads, so removing it rewinds the document to an older snapshot; worse, a room still open would then flush its newer live state back over that older base as a revert nobody asked for. Checking "is this the head" and deleting happen under one row lock, so the answer cannot go stale between the two.

To drop the current state, restore an earlier version instead: that moves history forward rather than truncating it.

### POST /api/documents/:documentId/versions/:version/restore

Puts a version's content back into the live document.

> Not to be confused with [`POST /api/documents/:documentId/restore`](#post-apidocumentsdocumentidrestore), which is the trash restore — it clears `deletedAt` on a soft-deleted document and touches no content.

The route says restore and the internals say revert; they name the same operation.

```json
{
  "success": true,
  "data": { "documentId": "kR4pZ2mQ7tY1nB8xW3v", "restoredFrom": 7, "backupVersion": 15 }
}
```

Three things happen, in order:

1. The stored snapshot is decoded and re-encoded against the current schema. A version the schema can no longer express is rejected with `422` before anything is opened or written.
2. The live document — including edits still inside the debounce window — is captured and committed as a new version named `Before restore of version N`. `backupVersion` is that row.
3. The body is replaced with the target content, and the save that follows is named `Restored version N`.

So a restore **appends** two versions and never rewinds the counter. Undoing one is a restore of the backup it wrote. Repeating the same restore is safe but not free: each call banks another backup and another restore row.

`backupVersion` is `number | null`. Null means the collaboration process's reply could not be read, not that no backup was taken — the row exists either way. A history UI should render the absence rather than reporting "no backup".

**When the backup cannot be committed, nothing is restored.** The `500` says so explicitly and the document is unchanged; that ordering is deliberate, so a worker that dies mid-operation still leaves the pre-restore state recoverable.

**When persistence is wedged**, the backup is already committed and the replacement may already be visible to live collaborators without ever reaching the database. That is the persist-failed `500`, and it carries the same rule as [`PATCH /content`](#patch-apidocumentsdocumentidcontent): verify with `GET` before retrying, and treat a repeat for the same document as persistence being wedged for it until the collaboration process restarts.

The editor's in-app revert runs the same operation over the collaboration server's stateless channel instead of this route. That path requires an authenticated, writable connection, which is why it can attribute the resulting rows to a person and this one cannot.

### Status codes

| Status | Code                    | When                                                                                                                                                                                                                                                                   |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Malformed `documentId`; a `version` or `base` that is not a positive integer within int4; a `base` at or above the version it is compared to; `limit` outside 1–100; negative `offset`; unknown `format`; a `name` that is empty after trimming or over 200 characters |
| `401`  | `UNAUTHORIZED`          | Missing, wrong, or user-JWT bearer; also when `SUPABASE_SERVICE_ROLE_KEY` is unset (fails closed)                                                                                                                                                                      |
| `404`  | `NOT_FOUND`             | No metadata row, the document is soft-deleted, or no such version — including an explicitly named `base`                                                                                                                                                               |
| `409`  | `CONFLICT`              | `DELETE` targeting the newest version                                                                                                                                                                                                                                  |
| `413`  | `PAYLOAD_TOO_LARGE`     | Write body over 16 KiB. These routes carry a name at most — content never rides them                                                                                                                                                                                   |
| `422`  | `DRAFT_DOCUMENT`        | Checkpoint or restore on a document that has never been saved. A draft has no history to name or roll back to                                                                                                                                                          |
| `422`  | `UNPROCESSABLE_ENTITY`  | Restore whose stored snapshot cannot be decoded, or cannot be re-encoded against the current schema. Nothing is written                                                                                                                                                |
| `429`  | —                       | Global rate limiter. Body is `{ "error": "...", "retryAfter": <seconds> }`, not the house envelope — see [Rate limiting](#rate-limiting)                                                                                                                               |
| `500`  | `INTERNAL_SERVER_ERROR` | Snapshot decode failure on read; the document could not be opened; the pre-restore backup failed; the save failed; or the REST and collaboration processes holding different service-role keys, which the message names explicitly                                     |
| `503`  | `SERVICE_UNAVAILABLE`   | The collaboration process is unreachable or did not answer within 30 s. Only the checkpoint and the restore hop, so no read route can return this                                                                                                                      |

`DRAFT_DOCUMENT` is specific to these routes. It shares the `422` status with invalid content so a caller that only reads the status still behaves correctly, and carries its own code so one can be told from the other.

### Internal version endpoints

`POST /internal/documents/:documentId/versions` and `POST /internal/documents/:documentId/versions/:version/restore` on the collaboration process's internal listener, beside [the content apply endpoint](#internal-apply-endpoint) and `/metrics`. Not Traefik-routed. REST forwards to them over `HOCUSPOCUS_INTERNAL_URL` with the same service-role bearer and the caller's `x-request-id`. Deploy `hocuspocus-server` before `rest-api` whenever this wire shape changes.

## Document conversion

Turn a document into a file, or a file into document content. Module: `src/modules/document-conversion/`.

| Direction | Formats             | Route                                            |
| --------- | ------------------- | ------------------------------------------------ |
| Export    | `docx`, `md`, `odt` | `GET /api/documents/:documentId/export?format=…` |
| Import    | `docx`, `md`        | `POST /api/documents/:documentId/import`         |

The asymmetry is deliberate: nothing reads ODT back, and a legacy `.doc` is refused rather than guessed at.

Both routes take either the service-role key (`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`) or a Supabase user token (`token: <jwt>`, or the same JWT as a bearer), and address the document by `documentId`, never by slug — see [Identifying a document](#identifying-a-document).

**A token is required whatever the document's privacy.** Both routes fall back to `requireUser`, not `optionalUser`, so a call with no credential is a `401` even on a public document. That is the rule a browser caller gets wrong most often — send the Supabase access token in the `token` header on every request, public documents included.

**Access matrix.** The service-role key passes every row. A user token runs the same private-document predicate as the WebSocket gate and `GET /api/documents/:slug` (`resolvePrivateAccess` in `src/lib/privateAccess.ts`) — one rule, three surfaces.

| Document                                      | `GET /export`                  | `POST /import`       |
| --------------------------------------------- | ------------------------------ | -------------------- |
| Public, unlocked                              | any signed-in caller           | any signed-in caller |
| Private, caller owns it                       | `200`                          | `200`                |
| Private, caller signed in as someone else     | `403 FORBIDDEN`                | `403 FORBIDDEN`      |
| Private, caller anonymous or `ownerId` null   | `401 UNAUTHORIZED`             | `401 UNAUTHORIZED`   |
| Public and `readOnly`, caller does not own it | `200` — the lock is write-only | `403 FORBIDDEN`      |

The privacy rule runs first, so a document that is both private and locked answers with the privacy outcome. Import gates on write access because a locked document's readers can never apply what it returns, and the conversion costs real CPU either way. The `readOnly` rule is the one the WebSocket handshake enforces: the owner keeps edit rights, everyone else is refused.

**Import writes no content.** It returns Tiptap JSON and leaves the document untouched; the caller applies it with [`PATCH /content`](#patch-apidocumentsdocumentidcontent), which enforces the read-only lock on the write itself — import enforces it on admission. It is not side-effect free, though: images embedded in the uploaded file are re-hosted to object storage before the JSON returns, so a caller that discards the response leaves those objects behind. Read the [fidelity contract](#fidelity-contract) before converting anything you cannot re-create.

### GET /api/documents/:documentId/export

Renders the document to a file. Query: `format` = `docx` (default), `md`, or `odt`.

The `200` body is the raw file, not the house envelope; errors still carry it. `Content-Disposition` is `attachment` with the slugified title, falling back to the slug and then the `documentId`, so a title that slugifies to nothing — all emoji — cannot produce a bare `.docx`.

**Staleness.** Export reads the persisted head, the same snapshot `GET /content` serves, so it trails an actively edited document by the store debounce — 10 s idle, 60 s maximum.

A document whose metadata exists but has no snapshot yet exports as an empty file, not a `404`.

### POST /api/documents/:documentId/import

Body is `multipart/form-data` with field name **`documentFile`** (not `file`, and not the media route's `mediaFile`). There is no raw-body variant: one field means one size cap and one format check for every upload.

**The container decides the format, not the filename or the declared MIME type.** Both lie too often to trust:

| First bytes   | Read as                                                   |
| ------------- | --------------------------------------------------------- |
| `50 4B 03 04` | `.docx` (zip)                                             |
| `D0 CF 11 E0` | legacy OLE2 `.doc` → `415`, re-save as `.docx`            |
| anything else | Markdown, if it decodes as strict UTF-8 — otherwise `422` |

The strict decode is Markdown's real gate; a BOM is stripped, so a Windows-written `.md` keeps its opening `#` instead of importing as one long paragraph.

> **Any non-`.docx` zip lands on the Word error.** ODT is a zip, so re-importing your own ODT export returns `422 The upload could not be read as a Word document`. That is the sniff working, not a mis-detected file — ODT import does not exist.

**Three different `413`s.** Any upload over 10 MiB (`MAX_IMPORT_BYTES`, matching the pad's media cap) is refused on size, and a `.docx` whose ZIP directory declares more than 40 MiB unpacked is refused before the converter opens it — a zip bounds its compressed size, never its inflated one, and 200 KiB of deflated padding reaches 200 MiB. Markdown is additionally capped at 65 536 characters, because `marked` parses in quadratic time — 64 KiB takes ~0.6 s, 954 KiB blocks the event loop for ~144 s. That cap rejects; it never truncates, since half a document is worse than a refused one. Convert the file to `.docx` to get past it.

Images embedded in a Word file are re-hosted through [the media route](#post-apipluginshypermultimediadocumentid) so the result carries URLs the editor can parse instead of `data:` payloads. This needs `PUBLIC_RESTAPI_URL` — see [ENV.md](./ENV.md#public-origin). Without it, every image becomes a warning and the text still imports.

```json
{
  "success": true,
  "data": {
    "content": { "type": "doc", "content": [/* ... */] },
    "title": "Quarterly report",
    "warnings": [{ "code": "title-promoted-paragraph", "message": "…" }]
  }
}
```

The result always opens on a level-1 heading, so it satisfies `PATCH`'s title-first rule: an existing first heading is forced to level 1, a first paragraph is promoted to one (losing its marks), and a document with no usable opening text gets a heading synthesized from the slug. Each of the last two reports a warning — a paragraph silently becoming the document title is a change the caller has to see.

### Fidelity contract

Conversion is lossy in named ways. Import reports what it changed through `warnings`; export has no warning channel — a downloaded file is the only evidence — so the table below is the contract.

**What export drops**

| Content                                                                                             | DOCX                     | Markdown           | ODT                    |
| --------------------------------------------------------------------------------------------------- | ------------------------ | ------------------ | ---------------------- |
| The eight media embeds (`youtube`, `vimeo`, `loom`, `x`, `spotify`, `soundcloud`, `video`, `audio`) | link to the source       | link to the source | link to the source     |
| Images                                                                                              | picture, own origin only | `![alt](src)`      | **link to the source** |
| Highlight                                                                                           | **dropped**              | `==text==`         | kept                   |
| In-progress upload placeholders                                                                     | removed                  | removed            | removed                |

DOCX is the one format whose converter fetches: it downloads every `<img src>` to embed the bytes, and `src` is ordinary pad content, so only images on this server's own media origin (`PUBLIC_RESTAPI_URL`) are kept — a third-party or unreachable one is dropped rather than fetched, and with no `PUBLIC_RESTAPI_URL` set no image is embedded at all. An embed becomes a paragraph holding its caption, or its URL when it has no caption. ODF draws a picture through a measured frame, and a remote image has no measured width, so ODT gives the reader a link it can follow rather than an empty box.

**What a DOCX round trip loses.** Export to `.docx` and import it back and the following do not survive: underline, blockquote (flattens to a paragraph), code block (flattens to a paragraph), horizontal rules, and table header cells (demote to normal cells). Word's own `Title`, `Subtitle` and `Quote` styles are mapped on the way in, so a file authored in Word fares better than one that made this round trip.

> **No export format carries `toc-id`.** That id is the identity a heading's chat channel, fold state and `?id=` deep link hang off. Imported content has none, so applying it with `mode=replace` re-keys every heading in the document and orphans all three, permanently — re-editing does not bring them back. **Default to `mode=append`** and reserve `replace` for a document whose heading identities nobody depends on yet. An appended import brings its own title heading with it, and the title-first check only looks at the document's first node, so drop or demote `content[0]` unless you want a second title heading in the middle of the document.

**Warning codes**

An empty `warnings` array means a clean import.

| Code                        | Meaning                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `media-placeholder-dropped` | One image could not be re-hosted and was dropped; the rest of the file imported |
| `title-promoted-paragraph`  | The first paragraph became the document title                                   |
| `title-synthesized`         | No usable opening text, so the title came from the slug                         |
| `unsupported-element`       | The converter met something it does not model                                   |

### Status codes

| Status | Code                     | When                                                                                                                                     |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`       | Malformed `documentId`, unknown `format`, a body that is not `multipart/form-data`, or no `documentFile` field                           |
| `401`  | `UNAUTHORIZED`           | Missing, wrong, or user-JWT bearer; also when `SUPABASE_SERVICE_ROLE_KEY` is unset (fails closed)                                        |
| `404`  | `NOT_FOUND`              | No metadata row, or the document is soft-deleted                                                                                         |
| `413`  | `PAYLOAD_TOO_LARGE`      | Upload over 10 MiB, a `.docx` declaring over 40 MiB unpacked, or Markdown over 65 536 characters                                         |
| `415`  | `UNSUPPORTED_MEDIA_TYPE` | Import of a legacy OLE2 `.doc`                                                                                                           |
| `422`  | `UNPROCESSABLE_ENTITY`   | Import of a file that is neither a zip nor UTF-8 text, or one too damaged for its converter to open. Retrying will not fix it            |
| `429`  | —                        | Global rate limiter. Body is `{ "error": "...", "retryAfter": <seconds> }`, not the house envelope — see [Rate limiting](#rate-limiting) |
| `500`  | `INTERNAL_SERVER_ERROR`  | Export only: the stored snapshot could not be decoded, or the converter threw                                                            |

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
