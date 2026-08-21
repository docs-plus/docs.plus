<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/hocuspocus` are documented here.

This file is the operator and API changelog. The pad product lives in the [root CHANGELOG](../../CHANGELOG.md). Route contracts live in [API.md](./API.md) and [docs/api](../../docs/api). Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

## [2.0.0] — 2026-08-21

**First stable tag of hocuspocus after the Etherpad years and the `2.0.0-beta.*` line.** webapp and hocuspocus share `2.0.0`. Admin stays `1.0.0`. This package is private and is not published to npm.

### Highlights

- **Persist is eventual.** Durable store waits 10 s idle, or 60 s while typing continues. The pad status chip is a 300 ms local timer. The version row is durable after the worker publishes `document:saved`.
- **Private is owner-only.** REST slug read and the WebSocket room share `resolvePrivateAccess`. Anonymous or ownerless-private → `sign-in-required`. Signed-in non-owner → `denied`.
- **Versions and restore.** List, read, checkpoint, restore, delete, and diff. The pad Restore button sends `history.revert`. Conversion writes no document content.
- **Three processes, narrow public edge.** REST, collaboration, and the persist worker. Traefik publishes only `/api` and `/health`. OpenAPI stays inside the network.
- **Draft identity.** A new slug derives `documentId` from the slug and epoch. First edit anchors the metadata row.
- **Service-role writes name the operation.** Content and version writes need the service-role bearer. Claim columns stay `null`. `trigger` carries the meaning.

### Breaking

- Store pads as Hocuspocus/Yjs snapshots. Etherpad is gone from this package.
- Run three processes: REST (`start:rest`), WebSocket (`start:ws`), and worker (`start:worker`).
- Require the persist worker. Without it, store jobs sit in Redis and expire after one hour.
- Require the flat heading schema. Nested heading history must run `migrate:nested-to-flat` first.
- Require camelCase media node names. Legacy PascalCase rows need `migrate:media-node-names`.
- Gate Private to the owner only. Signed-in non-owners get `denied`.
- Drop the first-claimer arm. Flipping Private no longer writes `ownerId`.
- Gate owned metadata `PUT` to the owner. Every other caller gets `403`.
- Require `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` on every content and version route.
- Address content by `documentId` only. Never by slug.
- Reject a heading-less `replace` with `422`. Documents stay title-first.
- Require `ownerId` on list to match JWT `sub`. Missing token → `401`. Mismatch → `403`.
- Refuse user-JWT `content` or `ownerId` on create. Both need the service-role key.
- Soft-deleted documents refuse new WebSocket joins.
- Keep anonymous sign-in off. Anonymous or ownerless Private rooms hit `sign-in-required`.

### Migration

**Nested → flat headings.** Snapshot Postgres. From `apps/hocuspocus.server`:

```bash
bun run migrate:nested-to-flat:dry
bun run migrate:nested-to-flat
```

Keep `ENABLE_SCHEMA_MIGRATION=true` through the window, then turn it off.

**Media node names.** Deploy the 2.0 camelCase extension first. Snapshot Postgres. See [migrate-media-node-names.md](./docs/migrate-media-node-names.md).

```bash
bun run migrate:media-node-names:dry
bun run migrate:media-node-names
```

Re-run `:dry` until it reports zero rows. Then turn `ENABLE_SCHEMA_MIGRATION` off.

**Self-host / deploy.** Start worker, then WebSocket, then REST. All three must stay up. Apply Prisma with `bun run prisma:migrate:deploy` when schema changes ship.

**Private / ownership.** Do not expect a Private flip to mint an owner. Backfill `ownerId` before sealing ownerless rows.

**If you consume the API.** Read [API.md](./API.md). A content `PATCH` `200` means applied and queued, not a durable Postgres commit.

### Added

- Add document REST: create, list, slug read, metadata, trash, restore, duplicate, and purge.
- Add `GET` and `PATCH /api/documents/:documentId/content` with `mode=replace` or `append`.
- Forward each PATCH to the collaboration process on the internal hop.
- Cap each content body at 5 MiB, 50 000 nodes, and 100 nesting levels.
- Add versions REST: list, checkpoint, read, block diff, delete, and restore. Service-role only.
- Add WebSocket ops `history.list`, `history.watch`, and `history.revert`.
- Stamp version rows with `trigger`, `triggeredBy`, and `contributors`.
- Record per-range authorship on live edits. Diff responses join `clientIds` to profiles at read time.
- Add `GET /api/documents/:documentId/export` for `docx`, `md`, and `odt`.
- Add `POST /api/documents/:documentId/import` for `docx` and `md`. Import returns Tiptap JSON only.
- Accept the service-role key or a user token on conversion. Apply the same privacy and lock checks as the pad.
- Re-host Word-embedded images through the media route when `PUBLIC_RESTAPI_URL` is set.
- Cap imports at 10 MiB upload, 40 MiB inflated `.docx`, and 65 536 Markdown characters.
- Report import `warnings` for title promotion, a synthesized title, dropped media, and unsupported elements.
- Share `resolvePrivateAccess` and `resolveWsAccess` on REST and WebSocket.
- Live-seal a room over Redis when Private, Deleted, or Read-only changes.
- Enforce read-only on the write path. Non-owners get `connectionConfig.readOnly = true`.
- Relay only `{ type: 'docTitle' }` on the default stateless arm, up to 64 KiB.
- Derive a draft `documentId` from slug and purge epoch.
- Add owner-only duplicate of the latest Yjs snapshot.
- Add claim-check persist. The worker merges, strips, and then publishes `document:saved`.
- Add operator DLQ drain that re-enqueues stranded saves through the merge path.
- Add hourly autosave prune and a soft-delete reaper (`DOC_DELETE_RETENTION_DAYS`).
- Add `scripts/backfill-strip-ghosts.ts` to erase recoverable deleted text from old rows.
- Add `document_store_rejections_total` so a swallowed fallback failure stays alertable.
- Serve OpenAPI 3.1 at `GET /openapi.json` and Swagger UI at `GET /docs`. Both stay off the public edge.
- Add collaboration readiness at `/health/ready` gated on Postgres.
- Add admin media-storage audit, signups trend, and message-engagement stats.

### Changed

- Treat a content `PATCH` `200` as applied and queued. It is not a durable database row.
- Keep GET content on the persisted head. Active browser edits can trail by the store debounce.
- Read the persisted head for export. Live unsaved edits are not in the file.
- Debounce durable store at 10 s idle, or 60 s while typing continues.
- Move Yjs decode and metadata strip off the WebSocket loop into the worker.
- Seal rooms on purge only. Soft-delete still flushes the close-time window.
- Thin unnamed autosaves and machine triggers `revert-backup` and `schema-migration` under retention.
- Clamp private rows out of any list without a verified owner scope.
- Return `404` for a soft-deleted slug. Never synthesize a draft under that slug.
- Ignore Private and Read-only on an ownerless row. Title stays open.
- Verify WebSocket identity with Supabase `getUser`. The room name is the Prisma `documentId`.
- Route email and push through pgmq → worker → BullMQ. There is no public `/api/push`.
- Stream media reads. Align the document media MIME allowlist with chat.
- Put rate-limit `429` on the house envelope with code `RATE_LIMIT_EXCEEDED`.
- Sample cron health every 60 s. Export queue, pgmq, and cron metrics from the worker.

### Fixed

- Stop a rejected `store()` from wedging the debouncer for the process lifetime.
- Merge raw then strip so deleted text inside a surviving parent does not return.
- Re-arm claim-check TTLs so a worker outage does not strand payloads.
- Remove soft-deleted DLQ entries instead of parking them for the reaper.
- Stop a purged document from recreating via a close-time flush.
- Rehost duplicate media under the copy prefix. Forward-only for older copies.
- Bump the slug epoch with the metadata delete so a purged slug cannot reuse the id.
- Measure `.docx` zip inflation under a budget.
- Keep DOCX export image fetches on the media origin. Inline only PNG and JPEG.
- Wrap stray inline nodes on Markdown import so the result composes with `PATCH /content`.
- Key the rate limiter on client IP alone. A Redis store fault no longer 500s limited routes.
- Require a verified user for media upload. Gate upload on privacy, soft-delete, and read-only.
- Resolve outbound hosts before trusting them for link-metadata fetch.
- Refuse push subscriptions that fail the shared outbound URL check.
- Bound `history.list` per connection and `history.revert` per document.
- Make the published OpenAPI document match the routes it documents.

### Security

- Reject invalid or expired JWTs in production at `onAuthenticate`.
- Stop the default stateless arm from forwarding client-chosen envelopes.
- Enforce Private from authoritative metadata on REST and WebSocket.

### Removed

- Remove the Etherpad application from this package.
- Drop the first-claimer arm that wrote `ownerId` on the first lock flip.
- Drop dead `history.prev` and `history.next` stateless branches.
- Remove `/api/email/send`. Generic send is service-role only.

### Documentation

- Keep the public contract in [API.md](./API.md) and [docs/api](../../docs/api).
- Document environment variables in [ENV.md](./ENV.md).
- Document the media-name migration in [migrate-media-node-names.md](./docs/migrate-media-node-names.md).

---

## Pre-`2.0` history

This package shipped as `2.0.0-beta.103` with the webapp. There is no earlier hocuspocus changelog. Operator notes from the beta line land in this `2.0.0` entry.

---

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/docs-plus/docs.plus/compare/v1.8.18...v2.0.0
