<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/hocuspocus` are documented here.

This file is the operator and API changelog. The pad product lives in the [root CHANGELOG](../../CHANGELOG.md). Route contracts live in [API.md](./API.md) and [docs/api](../../docs/api). Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- **Markdown import keeps playable media.** A paragraph that is only a media
  URL becomes that media node (`video`, `audio`, and the six embeds). A typed
  `![youtube](url)` (and the same for the other block media nodes) is lifted
  out of its paragraph so `PATCH /content` accepts the JSON. Filter links,
  labeled links, and a media URL inside a list item stay links. Picture size
  is still empty on the import JSON; Settings replace writes natural width
  and height in the browser.
- **What changed in a document, per heading section.**
  `GET /api/documents/:documentId/changes?since&until&scope` compares the newest stored
  snapshot at or before `since` with the newest at or before `until`. Service-role only.
  `since` is required, `until` defaults to the moment the request is served, and `scope` is
  `summary` (default) or `headings`. The `headings` scope adds the full outline tree,
  unchanged headings included. Read-only: nothing is written and no live document loads.
  Two fast paths answer without decoding a snapshot, when both ends resolve to the same
  version row and when two rows hold identical bytes. `changed` comes from the section
  statuses, never from the bytes, so a window that only spans the editor's first-open
  `toc-id` stamping pass reports `changed: false`. A section's `magnitude` is null when the
  edit changed formatting rather than words; its status still says `modified`. Attribution
  is decoration, and a profile-lookup outage empties `contributors` rather than failing.
- **Owner-only Favorite.** `PUT /api/documents/:documentId/favorite` accepts
  `{ favorite: boolean }` and writes a `DocumentFavorite` join for `token.sub`
  (`userId` + `documentId`). Migration `20260901100000_add_document_favorites` adds the
  table. Soft-deleted documents are `404`. Soft-delete of the document keeps the join, so
  restore stays favorited. Purge cascade-drops the row.
- **Owner live lists pin Favorites first.** `GET /api/documents?ownerId=token.sub`
  returns `isFavorite` and orders that user's Favorites first, then `sort`. Trash and the
  public fleet omit both.

### Documentation

- Record the Favorite route and owner-list `isFavorite` in [API.md](./API.md). The
  required-token list in [docs/api/authentication.md](../../docs/api/authentication.md)
  now includes favorite and unfavorite.
- Record Markdown import media in [API.md](./API.md). A lone media URL, or a
  provider address written as an image, becomes a player node that `PATCH /content`
  accepts. Picture size stays empty on that JSON.

## [2.0.1] — 2026-08-31

**An operator release.** No route contract changes and no API surface changes. This entry
names runtime behaviour, the image, and one test correction. webapp and hocuspocus share
`2.0.1`. This package is private and is not published to npm.

### Fixed

- **A crashed process now exits `1`.** All three entrypoints routed `uncaughtException` into
  `shutdown()`, whose success path ended at `process.exit(0)`, so a crash reported success.
  Docker's restart policy and `concurrently --kill-others-on-fail` both key on the exit
  code, so neither reacted. `shutdown()` now takes an exit code. The `SIGINT` and `SIGTERM`
  handlers are wrapped, because a bare handler receives the signal name and it would land
  in that parameter. A clean `SIGTERM` still exits `0`.

### Changed

- **The production image no longer stamps ownership with a recursive `chown`.** That
  rewrites every inode, so Docker stored a second full copy of the tree — 1.91 GB in one
  layer, and 125.3 s of every production build. `COPY --chown` writes ownership as each
  layer lands. Only the media write path is stamped, because `storage.local.ts` resolves
  `./temp/<plugin>` against the working directory the entrypoint sets. `node_modules` and
  the generated Prisma client now stay root-owned and read-only to the runtime user.
- **The production install is scoped with `--filter '@docs.plus/hocuspocus'`.** A bare root
  install resolves every workspace member, so the image shipped two Next.js versions, four
  `@next/swc` native binaries, `react-icons`, `@emoji-mart/data` and `typescript` — about
  950 MB that REST, the collaboration server and the worker never import. The image is
  961 MB on the production host, down from 5.67 GB.
- **The Bun floor is `1.4.0`.**

### Tests

- `tests/integration/worker.test.ts` awaits real events instead of fixed sleeps. It held
  5,500 ms of `Bun.sleep` in a file costing 5,733 ms. The shutdown case slept two seconds
  and then asserted the exit code, so a correct process whose drain took longer failed.
  It now awaits the subprocess exit and polls for readiness. The suite falls from 7,952 ms
  to 3,117 ms at 578 pass and 0 fail. **The runtime is not the cause** — on the unchanged
  tests Bun 1.3.14 took 7,256 ms and Bun 1.4.0 took 7,952 ms.

### Notes

- **The metascraper `5.50.6` pin stays.** An attempt to drop it failed deploy `33365858244`
  in Backend E2E with `TypeError: require() async module` on Bun 1.4.0. Four separate local
  checks passed before it shipped and every one was wrong. See `AGENTS.md` §Dependencies
  for the list, and do not re-attempt the drop from a laptop.

## [2.0.0] — 2026-08-26

**First stable tag of hocuspocus after the Etherpad years and the `2.0.0-beta.*` line.** webapp and hocuspocus share `2.0.0`. Admin stays `1.0.0`. This package is private and is not published to npm.

### Highlights

- **Persist is eventual.** Durable store waits 10 s idle, or 60 s while typing continues. The pad status chip is a 300 ms local timer. The version row is durable after the worker publishes `document:saved`.
- **Private is owner-only.** REST slug read and the WebSocket room share `resolvePrivateAccess`. Anonymous or ownerless-private → `sign-in-required`. Signed-in non-owner → `denied`.
- **Versions and restore.** The versions routes list, read, checkpoint, restore, delete, and diff a version. The pad Restore button sends `history.revert`. Conversion writes no document content.
- **Three processes, narrow public edge.** REST, collaboration, and the persist worker. Traefik publishes `/api`, `/health`, and the collaboration `/websocket` route. OpenAPI and the internal listener stay inside the network.
- **Draft identity.** A new slug derives `documentId` from the slug and epoch. The first edit anchors the metadata row.
- **Service-role writes name the operation.** Content and version writes need the service-role bearer. Claim columns stay `null`. `trigger` carries the meaning.

### Breaking

- Store pads as Hocuspocus/Yjs snapshots. Etherpad is gone from this package.
- Run three processes: REST (`start:rest`), WebSocket (`start:ws`), and worker (`start:worker`).
- Require the persist worker. Without it, store jobs pile up in Redis and no version row is written. A job waiting in the queue keeps its payload, because the WebSocket process re-arms the key every 10 minutes.
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

**Self-host / deploy.** Run `bun run prisma:migrate:deploy` first, and let it finish before any process starts. `DocumentPurgeTombstone` must exist, or every handshake that finds no metadata row is denied, which is the new-pad flow. Then start worker, then WebSocket, then REST. All three must stay up.

**Private / ownership.** Do not expect a Private flip to mint an owner. Backfill `ownerId` before sealing ownerless rows.

**If you consume the API.** Read [API.md](./API.md). A content `PATCH` `200` means applied and queued, not a durable Postgres commit.

### Added

- Add document REST: create, list, slug read, metadata, trash, restore, duplicate, and purge.
- Add `GET` and `PATCH /api/documents/:documentId/content` with `mode=replace` or `append`.
- Forward each PATCH to the collaboration process on the internal hop.
- Serve `/metrics` and the internal service-role write endpoints on the collaboration process's own listener. It binds `HOCUSPOCUS_INTERNAL_HTTP_PORT` (default `4003`) and `HOCUSPOCUS_INTERNAL_HTTP_HOST` (default `0.0.0.0`). Traefik never routes it, and REST reaches it over `HOCUSPOCUS_INTERNAL_URL`.
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
- Live-seal a room over Redis when Private, Deleted, or Read-only changes. Deleted closes every connection. Private closes every non-owner. Read-only marks every non-owner socket read-only.
- Enforce read-only on the write path. Non-owners get `connectionConfig.readOnly = true`.
- Relay only `{ type: 'docTitle' }` on the default stateless arm, up to 64 KiB.
- Derive a draft `documentId` from slug and purge epoch.
- Record every purge in the `DocumentPurgeTombstone` table. The collaboration handshake now tells a purged document apart from one that never existed, and denies the purged one. That denial counts as `ws_auth_rejections_total{reason="purged"}`.
- Add owner-only duplicate of the latest Yjs snapshot.
- Add claim-check persist. The worker merges, strips, and then publishes `document:saved`.
- Add operator DLQ drain that re-enqueues stranded saves through the merge path.
- Add an hourly autosave prune job that thins old versions (`DOC_AUTOSAVE_RETENTION_DAYS`, default `30`). Add a soft-delete reaper (`DOC_DELETE_RETENTION_DAYS`, default `30`). Set either to `0` to turn it off.
- Add `scripts/backfill-strip-ghosts.ts` to erase recoverable deleted text from old rows.
- Add `document_store_rejections_total` so a swallowed fallback failure stays alertable.
- Answer `503` with code `AUTH_UNAVAILABLE` when Supabase token verification is unreachable. The code is distinct from `SERVICE_UNAVAILABLE`, so a caller can tell an auth outage from any other one.
- Serve OpenAPI 3.1 at `GET /openapi.json` and Swagger UI at `GET /docs`. Both stay off the public edge.
- Expose REST health probes at `/health`, `/health/database`, `/health/redis`, `/health/supabase`, and `/health/push`. Each answers `200` when healthy and `503` when not.
- Add collaboration readiness at `/health/ready` gated on Postgres.
- Gate the persist worker's `/health` on dequeue liveness. The check fails once the oldest waiting store job passes `STORE_QUEUE_MAX_WAIT_AGE_MS` (`120_000` ms), so a parked fetch loop can no longer report healthy.
- Serve one-click unsubscribe at `GET` and `POST /api/email/unsubscribe`. The `POST` arm is the RFC 8058 `List-Unsubscribe-Post` handler that mail clients call. The token is the only credential.
- Add the admin media-storage audit and stats for the signups trend, communication, and message types.

### Changed

- Treat a content `PATCH` `200` as applied and queued. It is not a durable database row.
- Keep GET content on the persisted head. Active browser edits can trail by the store debounce.
- Read the persisted head for export. Live unsaved edits are not in the file.
- Debounce durable store at 10 s idle, or 60 s while typing continues.
- Move Yjs decode and metadata strip off the WebSocket loop into the worker.
- Seal rooms on purge only. Soft-delete still flushes the close-time window.
- Thin unnamed autosave versions past `DOC_AUTOSAVE_RETENTION_DAYS` to one row per document per day. A name a person typed is exempt forever. The machine triggers `revert-backup` and `schema-migration` are not, so a very old restore stops being undoable.
- Clamp private rows out of any list without a verified owner scope.
- Return `404` for a soft-deleted slug. Never synthesize a draft under that slug.
- Ignore Private and Read-only on an ownerless row. Title stays open.
- Verify WebSocket identity with Supabase `getUser`. The room name is the Prisma `documentId`.
- Route email and push through pgmq → worker → BullMQ. There is no public `/api/push`.
- Stream media reads. Align the document media MIME allowlist with chat.
- Floor a `DO_STORAGE_MAX_FILE_SIZE` under 1 MB back to the 10 MB default, with a startup warning. A mis-set value can no longer brick pad media upload.
- Put rate-limit `429` on the house envelope with code `RATE_LIMIT_EXCEEDED`. The one limit is `RATE_LIMIT_MAX` (default `100`) per 15-minute window. Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. A `429` adds `Retry-After`. Health routes are exempt.
- Sample cron health every 60 s. Export queue, pgmq, and cron metrics from the worker.

### Fixed

- Stop a rejected `store()` from wedging the debouncer for the process lifetime.
- Merge raw then strip so deleted text inside a surviving parent does not return.
- Re-arm claim-check TTLs so a worker outage does not strand payloads.
- Remove soft-deleted DLQ entries instead of parking them for the reaper.
- Give the store dead-letter drain an `unresolved` disposition. An entry with no metadata row and no purge tombstone stays in the queue for an operator instead of being discarded.
- Stop a purged document from recreating via a close-time flush.
- Rehost duplicate media under the copy prefix. Forward-only for older copies. The server answers `413` when a source snapshot names more than `MAX_DUPLICATE_MEDIA_OBJECTS` (`32`) objects.
- Bump the slug epoch with the metadata delete so a purged slug cannot reuse the id.
- Check the retention window before the reaper purge calls the Supabase RPC and deletes media. A document that is no longer past retention is refused.
- Re-assert staleness inside the admin bulk stale delete. It runs the same predicate the stale list serves, so a slug that is no longer stale is reported back and left alone.
- Measure `.docx` zip inflation under a budget.
- Keep DOCX export image fetches on the media origin. Inline only PNG and JPEG.
- Wrap stray inline nodes on Markdown import so the result composes with `PATCH /content`.
- Key the rate limiter on client IP alone. A Redis store fault no longer 500s limited routes.
- Require a verified user for media upload. Gate upload on privacy, soft-delete, and read-only.
- Resolve outbound hosts before trusting them for link-metadata fetch.
- Resolve a push endpoint host on every send, and treat a failed lookup as unsafe. That refusal charges nothing against the device, so one resolver problem cannot deactivate a live subscription.
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
- Add an operator runbook at [`docs/RUNBOOK-backend.md`](../../docs/RUNBOOK-backend.md). It covers four Grafana alerts, and each of those alerts links to it through a `runbook_url` annotation.

---

## Pre-`2.0` history

This package shipped as `2.0.0-beta.103` with the webapp. There is no earlier hocuspocus changelog. Operator notes from the beta line land in this `2.0.0` entry. The package descends from the `backend/` directory of the first commit, `5af33c42e`, dated 2022-09-20. It has used Hocuspocus with Prisma and Postgres since then.

---

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.0
