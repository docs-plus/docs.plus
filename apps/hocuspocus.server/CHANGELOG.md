<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/hocuspocus` are documented here.

This file is the operator and API changelog. The pad product lives in the [root CHANGELOG](../../CHANGELOG.md). The pad UI lives in [`apps/webapp/CHANGELOG.md`](../webapp/CHANGELOG.md). Route contracts live in [API.md](./API.md) and [docs/api](../../docs/api). Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Migration

Push Supabase migration `20261023120000` with this deploy. It drops and re-creates
`get_document_member_previews`, `get_document_members` and
`admin_get_document_member_counts` with new parameter names (`p_document_ids`,
`p_document_id`) and a `document_id` result column. An old client gets an error until both
sides land. Run `packages/supabase/scripts/check-grants.sql` after the push.

### Fixed

- **The admin dashboard counts members on older documents
  ([#574](https://github.com/docs-plus/docs.plus/issues/574)).** `adminStats.service.ts`
  sends the exact `documentId` and maps rows by `document_id`. The old lowercased key
  matched no workspace made before 2026-08-09.

### Internal

- `@sentry/bun` is `11.9.0`. The init uses the same `dataCollection` baseline as the webapp.
- The root overrides pin `prosemirror-model` `1.25.12`, `prosemirror-transform` `1.12.2`, and `prosemirror-view` `1.42.6`.
- `prosemirror-changeset` stays `2.4.1`. `@tiptap/pm` 3.32.0 asks for `^2.4.4`. Later versions halve `MAX_DIFF_SIZE`.

## [2.2.0] — 2026-10-22

The webapp and hocuspocus share `2.2.0`. Admin stays `1.0.0`. This package is private and is not published to npm.

This minor release is a SemVer exception. Its Breaking items touch only self-hoster config and API callers, while the `2.x` pad product line is unchanged ([RELEASE_POLICY.md Status](../../RELEASE_POLICY.md#status)).

### Highlights

- **More AI apps sign in to the MCP connector ([#550](https://github.com/docs-plus/docs.plus/issues/550), [#551](https://github.com/docs-plus/docs.plus/issues/551)).**
  The protected-resource metadata also answers at the RFC 9728 root URLs, so
  `claude mcp login` can sign in. A verified `/api/mcp` call spends a
  per-person budget, not the per-address limit.
- **AI apps can write Mermaid diagrams ([#522](https://github.com/docs-plus/docs.plus/issues/522)).**
  The server parses each diagram with Pele before the write. It refuses a
  diagram that the pad cannot draw, and nothing is written.
- **Redis requires a password ([#438](https://github.com/docs-plus/docs.plus/issues/438)).**
  Set `REDIS_PASSWORD` before you deploy.
- **A Private document's media loads only for its owner ([#439](https://github.com/docs-plus/docs.plus/issues/439)).**
  Set `MEDIA_COOKIE_SECRET` before you deploy.
- **Supabase grants are closed in one pass.** Helper functions, self-gated
  RPCs, trigger functions, anon tables and new partitions lose their open
  grants. New tables, sequences and functions start closed
  ([#469](https://github.com/docs-plus/docs.plus/issues/469),
  [#470](https://github.com/docs-plus/docs.plus/issues/470),
  [#318](https://github.com/docs-plus/docs.plus/issues/318),
  [#315](https://github.com/docs-plus/docs.plus/issues/315),
  [#316](https://github.com/docs-plus/docs.plus/issues/316)).
- **An admin can soft-delete one account on the owner's request ([#471](https://github.com/docs-plus/docs.plus/issues/471)).**

### Breaking

- **Redis needs `REDIS_PASSWORD` ([#438](https://github.com/docs-plus/docs.plus/issues/438)).**
  `docker-compose.prod.yml` reads it with `:?`, so `docker compose up` stops
  when it is empty. The prod, stage and observability deploy workflows refuse
  to deploy without it.
- **Private media needs `MEDIA_COOKIE_SECRET` ([#439](https://github.com/docs-plus/docs.plus/issues/439)).**
  When it is unset, Private media answers `404`, even to the owner. The prod
  and stage deploy workflows refuse to deploy without it.
- **The bundled Traefik needs one more `Host` line ([#550](https://github.com/docs-plus/docs.plus/issues/550)).**
  The new `rest-api-wellknown` router in `docker-compose.prod.yml` names
  `prodback.docs.plus`. Set it to your API host. With your own proxy, route
  `/.well-known/oauth-protected-resource` to `rest-api`.
- **New objects start closed ([#316](https://github.com/docs-plus/docs.plus/issues/316)).**
  A new table, sequence or function in `public` gives `anon` nothing. A new
  function in any schema gets no `PUBLIC` execute. A custom migration must
  grant its own objects in the same file.
- **Open grants are revoked ([#469](https://github.com/docs-plus/docs.plus/issues/469), [#470](https://github.com/docs-plus/docs.plus/issues/470), [#318](https://github.com/docs-plus/docs.plus/issues/318)).**
  A caller that uses the anon key or PostgREST directly may lose access to an
  `internal` helper, a table or an RPC. See Security.
- **Five functions, a table and an extension are dropped ([#319](https://github.com/docs-plus/docs.plus/issues/319), [#320](https://github.com/docs-plus/docs.plus/issues/320), [#321](https://github.com/docs-plus/docs.plus/issues/321)).**
  `create_direct_message_channel`, four `public` functions, the `PushSentLog`
  table and the `pg_net` extension are gone. See Removed.
- **The MCP read tools return text only ([#456](https://github.com/docs-plus/docs.plus/issues/456), [#457](https://github.com/docs-plus/docs.plus/issues/457)).**
  `find_documents`, `get_outline`, `read_document`, `list_chat_rooms` and
  `read_chat_thread` return one framed text block and no `structuredContent`.
  A client that read their `structuredContent` must read the text block. The
  write tools and `create_document` keep theirs.
- **`/mcp` is a reserved slug ([#458](https://github.com/docs-plus/docs.plus/issues/458)).**
  The webapp serves a page at `/mcp`. Production had no document with that
  slug, checked on 2026-10-21.

### Migration

Follow these steps in order to upgrade from `2.1.0`. Each step names the
installs it is for. A **scripts install** was built from
`packages/supabase/scripts/`, as
[install step 2](../../docs/self-hosting/install.md#2-prepare-supabase) says.
It has no migration history. A **migration-history install** applies Supabase
migrations with `supabase db push`, as docs.plus production does.

1. **Back up** (every install). See
   [Back up your data](../../docs/self-hosting/README.md#back-up-your-data).
   Migrations only go forward.
2. **Set `REDIS_PASSWORD`** (every install). Use 32 characters or more, for
   example `openssl rand -hex 32`. Put it in `.env.production`. If you run the
   observability stack, put the same value in `.env.observability`. Compose
   reads it with `:?`, so the stack does not start without it. The prod, stage
   and observability workflows refuse to deploy without it.
3. **Set `MEDIA_COOKIE_SECRET`** (every install). Use 32 characters or more,
   in `.env.production`. The prod and stage workflows refuse to deploy without
   it. When it is unset, Private media answers `404`, even to the owner.
4. **Route the well-known path** (every install). With the bundled Traefik,
   edit the `Host` in the new `rest-api-wellknown` rule in
   `docker-compose.prod.yml`, as
   [install step 4](../../docs/self-hosting/install.md#4-point-your-domains-at-the-server)
   says. With your own proxy, route `/.well-known/oauth-protected-resource` to
   `rest-api`.
5. **Grant the exporter login `pg_read_all_stats`** (installs on DigitalOcean
   managed PostgreSQL that run `postgres-exporter`). `doadmin` cannot grant
   `pg_monitor` there
   ([#443](https://github.com/docs-plus/docs.plus/issues/443)). Use
   `sslmode=require` in `POSTGRES_EXPORTER_DSN`. See Security.
6. **Run `packages/supabase/scripts/check-grants.sql` as a baseline** (every
   install). Run it read-only: in the Supabase SQL editor, or with `psql` and
   `PGOPTIONS='-c default_transaction_read_only=on'`. Rows are expected
   before the migrations. Keep them to compare.
7. **Apply the 14 Supabase migrations** (every install). Apply them in
   timestamp order, before the new server starts. No migration is held.
   - Scripts install: apply each file by hand in the Supabase SQL editor, as
     [install](../../docs/self-hosting/install.md#upgrade-to-a-new-release)
     upgrade item 6 says. Do not run `supabase db push`.
   - Migration-history install: run one `supabase db push`.
8. **Run `check-grants.sql` again** (every install). Expect 0 rows. Any row
   blocks the next push until it is fixed or ruled.
9. **Deploy the new apps first** (every install). Build the images and run the
   database migration, as install upgrade items 8 and 9 say. This release adds
   no Prisma migration. Then restart the apps, as item 10 says. The new apps
   send `REDIS_PASSWORD`, and a Redis with no password still accepts it, so
   nothing breaks yet. This also recreates `rest-api`, which carries the new
   router.
10. **Then recreate Redis, so it requires the password** (every install). Item
    10 uses `--no-deps`, so it never recreates Redis on its own. At the
    repository root:

    ```bash
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d redis
    ```

    Do this only after every app runs the new image. An old app sends no
    password, and gets `NOAUTH` once Redis requires one. If you run the
    observability stack, redeploy it next, so `redis-exporter` reads its copy
    of the password.

**The 14 new Supabase migrations**, in timestamp order:

| Migration                                                     | Issue                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `20261014120000_presence_stamp_online_only`                   | [#489](https://github.com/docs-plus/docs.plus/issues/489)            |
| `20261014120100_bell_reads_online_lease`                      | [#490](https://github.com/docs-plus/docs.plus/issues/490)            |
| `20261014120300_skip_email_when_channel_read`                 | [#497](https://github.com/docs-plus/docs.plus/issues/497)            |
| `20261014121000_revoke_internal_helper_execute`               | [#469](https://github.com/docs-plus/docs.plus/issues/469)            |
| `20261014121100_close_self_gated_and_trigger_function_grants` | [#318](https://github.com/docs-plus/docs.plus/issues/318)            |
| `20261014121200_revoke_anon_default_table_privileges`         | [#470](https://github.com/docs-plus/docs.plus/issues/470)            |
| `20261014121300_close_new_document_views_partitions`          | [#315](https://github.com/docs-plus/docs.plus/issues/315)            |
| `20261014121400_drop_create_direct_message_channel`           | [#319](https://github.com/docs-plus/docs.plus/issues/319)            |
| `20261014121500_drop_pg_net`                                  | [#321](https://github.com/docs-plus/docs.plus/issues/321)            |
| `20261019120000_skip_notification_for_deleted_receiver`       | [f21eb3810](https://github.com/docs-plus/docs.plus/commit/f21eb3810) |
| `20261019130000_message_counter_skip_deleted_channel`         | [7f0840b3e](https://github.com/docs-plus/docs.plus/commit/7f0840b3e) |
| `20261019140000_users_heartbeat_hot_index`                    | [#491](https://github.com/docs-plus/docs.plus/issues/491)            |
| `20261021120000_default_privileges_close_new_objects`         | [#316](https://github.com/docs-plus/docs.plus/issues/316)            |
| `20261021120100_drop_prod_only_drift`                         | [#320](https://github.com/docs-plus/docs.plus/issues/320)            |

### Added

- **An admin can soft-delete one account on the owner's request ([#471](https://github.com/docs-plus/docs.plus/issues/471)).**
  Use `DELETE /api/admin/users/:id`. It clears the profile, removes the avatar and bans the user. It turns off push and email and drops pending queued email. The email address is kept. It refuses an admin or an unknown id. A `500` may leave the profile cleared. Retry the call.
- **The MCP server info names an icon ([#459](https://github.com/docs-plus/docs.plus/issues/459)).** `icons` lists the 192 px docs.plus mark
  at `APP_URL/icons/icon-192x192.png`, so a host that shows server icons can
  draw it. `server.json` describes the server for the official MCP Registry.
  Publishing it is a separate maintainer step.
- **AI apps can write Mermaid diagrams through the MCP connector ([#522](https://github.com/docs-plus/docs.plus/issues/522)).**
  The server instructions and the `markdown` field descriptions tell an agent that a `mermaid` fence becomes a diagram. The field descriptions also name the types it can start with. Before `create_document`, `append_to_document`, `edit_blocks` or `replace_text` writes, the server parses each diagram with Pele. It refuses an empty diagram, an unsupported type, a parse error, or one over 10 000 characters or 250 edges. Then nothing is written. Those are the pad's own limits, measured on real phones. A parse refusal carries Pele's message, so the agent can fix it. So does a refusal for one of Pele's other fixed limits, such as block-diagram space blocks. The backend now depends on `pele` 1.8.0.

### Changed

- **A verified `/api/mcp` call no longer spends the per-address rate limit
  ([#551](https://github.com/docs-plus/docs.plus/issues/551)).** Many people
  on one hosted AI app no longer share one bucket. A request without an
  accepted OAuth token, and the metadata routes, still spend it. Instead,
  every request with an accepted token spends a new per-person bucket of 300
  a minute, so `initialize` and `tools/list` stay bounded. The per-person
  budget of 60 tool calls a minute is unchanged. The token is
  checked only while the address has budget left. So a spent address gets a
  `429` even for a good token, and makes no Supabase Auth call. A token
  with no `client_id` or a past `exp` is refused before that call. One gap
  stays. Parallel requests that pass the budget check just before the address
  runs out each cost one Auth call, once per window.
- **`create_document` names a document titled "MCP" `mcp-document`.** The
  webapp now serves a page at `/mcp`, so `mcp` joins the route slugs
  ([#458](https://github.com/docs-plus/docs.plus/issues/458)).
- **Presence heartbeats no longer touch every `users` index.**
  `idx_users_online_status` now keys only `id`, so a heartbeat is a HOT
  update. The duplicate `idx_users_username` is dropped; `users_username_key`
  serves the same lookups. Apply the Supabase migration
  `20261019140000_users_heartbeat_hot_index`
  ([#491](https://github.com/docs-plus/docs.plus/issues/491)).

### Fixed

- **`claude mcp login` can sign in to the MCP connector
  ([#550](https://github.com/docs-plus/docs.plus/issues/550)).** It starts
  sign-in without a first request, so it never saw the `401` header. It probed
  the RFC 9728 root URLs, got `404`, and fell back to registering at
  `/register` on the API host. `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-protected-resource/api/mcp` now return the same metadata
  as `/api/mcp/.well-known/oauth-protected-resource`. The `401` header
  still names that last URL. A new Traefik router, `rest-api-wellknown`, routes only that
  prefix. Self-hosters edit one more host line (install guide, step 4).
- **Chat message counts no longer freeze after a channel is deleted ([7f0840b3e](https://github.com/docs-plus/docs.plus/commit/7f0840b3e)).** The
  message counter worker trusted the workspace id stored in each queued event.
  An event for a deleted channel then failed the `channel_id` foreign key. That
  one error rolled back every cron run, so no count updated again. The
  worker now reads the live channel row and drops events whose channel is gone.
  Apply the Supabase migration `20261019130000_message_counter_skip_deleted_channel`.
- **Claude Code now reads document and chat text through the MCP connector ([#456](https://github.com/docs-plus/docs.plus/issues/456)).**
  When a result has both a text block and `structuredContent`, Claude Code
  shows the model only `structuredContent`. `read_document` and
  `read_chat_thread` kept their text in the text block, so the model saw
  metadata and no text. The five read tools now return text only.
- **A person who left is no longer stuck `ONLINE` ([#489](https://github.com/docs-plus/docs.plus/issues/489)).** A one-time data fix sets
  `ONLINE` rows with a NULL `online_at` to `OFFLINE`. The `update-user-status`
  sweep never matched them, so those people got no bell, push or email.
  `update_user_online_at` now stamps `online_at` only on an `ONLINE` write, so
  a sweep or tab hide keeps the last heartbeat. This narrows the 2.1.0
  [#417](https://github.com/docs-plus/docs.plus/issues/417) entry. Apply the
  Supabase migration `20261014120000_presence_stamp_online_only`.
- **The chat bell now uses the online lease, as push does ([#490](https://github.com/docs-plus/docs.plus/issues/490)).** A member counts as
  online only when `status` is `ONLINE` and `online_at` is under 2 minutes old.
  Before, a member left `ONLINE` with a stale or NULL `online_at` got no bell,
  push or email. Apply the Supabase migration `20261014120100_bell_reads_online_lease`.
- **A queued email is skipped when the member already read the message in the
  channel ([#497](https://github.com/docs-plus/docs.plus/issues/497)).** The email check looked only at the bell read mark, so reading in
  the channel did not stop it. Apply the Supabase migration
  `20261014120300_skip_email_when_channel_read`.
- **A restore on a cold document waits for its own commit ([047cc0b34](https://github.com/docs-plus/docs.plus/commit/047cc0b34)).**
  It answers `503 DOCUMENT_BUSY` when earlier writes are still saving at the 20 s deadline, and nothing is restored.
- **An erased account no longer gets bell rows ([f21eb3810](https://github.com/docs-plus/docs.plus/commit/f21eb3810)).** Push and email already stopped. Apply the Supabase migration `20261019120000_skip_notification_for_deleted_receiver`.

### Security

- **Redis now requires a password ([#438](https://github.com/docs-plus/docs.plus/issues/438)).**
  Before, any container on the Docker network could read and write the queues
  and the sync pub/sub. `docker-compose.prod.yml` runs Redis with
  `--requirepass`, and every client sends `REDIS_PASSWORD`. Set it (32
  characters or more) in `.env.production`, or `docker compose up` stops. The
  `redis-exporter` service in `docker-compose.observability.yml` reads its copy
  from `.env.observability`, so set the same value there. The deploy workflows
  refuse to deploy without it. Dev and local Redis still run with no password.
- **MCP titles now stay inside the data frame ([#457](https://github.com/docs-plus/docs.plus/issues/457)).**
  This closes the known gap that 2.1.0 shipped with. `find_documents` frames
  its title list. `get_outline` and `list_chat_rooms` no longer repeat heading
  titles unframed in `structuredContent`. Each `get_outline` line now shows
  the heading level, which only `structuredContent` gave before.
- **Supabase grants are closed in one pass.** The `internal` helper functions,
  the self-gated RPCs, the trigger functions and the anon table rights lose
  their open default grants. New document-view partitions close themselves.
  Apply these Supabase migrations in order: `20261014121000`, `20261014121100`,
  `20261014121200` and `20261014121300`
  ([#469](https://github.com/docs-plus/docs.plus/issues/469),
  [#318](https://github.com/docs-plus/docs.plus/issues/318),
  [#470](https://github.com/docs-plus/docs.plus/issues/470),
  [#315](https://github.com/docs-plus/docs.plus/issues/315)). Run
  `packages/supabase/scripts/check-grants.sql` read-only before and after the
  push ([#317](https://github.com/docs-plus/docs.plus/issues/317)). The run before the push is a baseline. After the push, any row
  blocks the next push until it is fixed or ruled.
- **A Private document's media loads only for its owner ([#439](https://github.com/docs-plus/docs.plus/issues/439)).**
  An image request carries no token. So the webapp trades the session for an
  `HttpOnly` cookie, `dp_media`, after sign-in and on each token refresh. The
  media route serves a Private document's files only with the owner's cookie,
  with `Cache-Control: private, no-cache`. Anyone else gets `404`, as for
  Trash. Sign-out expires the cookie, and the cookie lasts one hour. A duplicate
  skips media from a Private document the requester cannot read. A DOCX
  export of a Private document still includes its images. Set the new
  `MEDIA_COOKIE_SECRET` (32 characters or more) on `rest-api` before you deploy.
  Unset fails closed: no one can load Private media, and REST logs one warning.
  The prod and staging deploys now stop when the secret is missing or shorter
  than 32 characters, and both env templates carry the line.
- **On DigitalOcean managed PostgreSQL, the exporter login gets
  `pg_read_all_stats`** ([#443](https://github.com/docs-plus/docs.plus/issues/443)).
  `doadmin` cannot grant `pg_monitor` there. `pg_read_all_stats` covers the
  stats views `postgres-exporter` reads. The self-hosting guide gives both.
  The exporter now runs with `--no-collector.wal`, because that collector
  needs `pg_monitor`, and no panel reads it. Do not copy DigitalOcean's sample
  connection string as it is. Its `sslrootcert=/path/to/ca-certificate.crt` is
  a placeholder, and every scrape fails with it. Use `sslmode=require`.
- **`follow-redirects` is pinned to 1.16.1 ([1dd664802](https://github.com/docs-plus/docs.plus/commit/1dd664802)).** Version 1.16.0 kept credential
  headers across a cross-origin redirect (GHSA-q3jh-wrc6-jgq8,
  GHSA-8r9p-f939-6h3c). It reaches the server through `axios`, which DOCX
  export uses. The root `overrides` moves only this package.
- **New tables, sequences and functions start closed ([#316](https://github.com/docs-plus/docs.plus/issues/316)).**
  The default privileges of role `postgres` no longer give `anon` anything new
  in `public`, and no new function gets `PUBLIC` execute in any schema. Existing
  objects do not change. A migration that adds a browser-facing object must now
  grant it in the same file. Apply the Supabase migration `20261021120000`, then
  run `packages/supabase/scripts/check-grants.sql`: it should return no rows.
- **Known gap: production access is not fully tightened yet ([#570](https://github.com/docs-plus/docs.plus/issues/570)).**
  This release ships with five gaps open. The Spaces access key reaches
  every bucket on the account. The Spaces CORS rules are too wide. The
  production database cluster also hosts other projects. On Supabase, role
  `postgres` still gives `anon` default rights on new sequences in `pgmq`. It
  also gives `anon` and `authenticated` default rights on new tables,
  sequences and functions in `storage`. The fixes are tracked on the issue.

### Removed

- **`create_direct_message_channel` and the `pg_net` extension
  ([#319](https://github.com/docs-plus/docs.plus/issues/319),
  [#321](https://github.com/docs-plus/docs.plus/issues/321)).** Nothing in the
  repo called either one. Apply the Supabase migrations `20261014121400` and
  `20261014121500`.
- **Five objects that only production had.** Four `public` functions
  (`cleanup_push_subscriptions`, `get_push_notification_stats`,
  `get_push_subscriptions`, `reset_workspace_unread_counts`) and the empty
  `PushSentLog` table. No code calls them, and the push cleanup cron job keeps
  running `internal.cleanup_push_subscriptions()`. Apply the Supabase migration
  `20261021120100` ([#320](https://github.com/docs-plus/docs.plus/issues/320)).

## [2.1.0] — 2026-10-13

The webapp and hocuspocus share `2.1.0`. Admin stays `1.0.0`. This package is private and is not published to npm.

This minor release is a SemVer exception. Its Breaking items touch only self-hoster config and API routes, while the `2.x` pad product line is unchanged ([RELEASE_POLICY.md Status](../../RELEASE_POLICY.md#status)).

### Highlights

- **MCP connector at `/api/mcp` ([#388](https://github.com/docs-plus/docs.plus/issues/388), [#389](https://github.com/docs-plus/docs.plus/issues/389)).**
  A person connects Claude or ChatGPT and signs in through the Supabase OAuth
  server. Ten tools find, read, create and edit documents, and read and post
  chat.
- **Email names its provider ([#419](https://github.com/docs-plus/docs.plus/issues/419)).**
  `EMAIL_PROVIDER` picks `resend` or `smtp`. The admin Email setup page shows
  the status, each problem and a test send. A Resend webhook records bounces
  and complaints.
- **Content-change notifications.** A save notifies the document's
  followers. The change digest mail shows what changed under each heading.
  `GET /api/documents/:documentId/changes` serves the same comparison.
- **A Private document's chat opens only for its owner ([#396](https://github.com/docs-plus/docs.plus/issues/396)).**
  `public.document_access` copies the Private flag and the owner into
  Supabase. Chat reads and writes check it.
- **Last left.** The server records when each signed-in reader last read a
  document. A change notice skips a person who still has the document open
  in a visible tab.

### Breaking

- **Email needs an explicit provider ([#419](https://github.com/docs-plus/docs.plus/issues/419)).** To send mail, set
  `EMAIL_PROVIDER` (`resend` or `smtp`) and `EMAIL_FROM`. With every provider
  key unset, email is `off`: the server boots, and queued mail settles
  `skipped`. A provider key without `EMAIL_PROVIDER` no longer picks a sender.
  It now holds all mail and logs `email config invalid` at error level.
- **SendGrid is removed.** `EMAIL_PROVIDER=sendgrid` is `invalid`.
- **Both deploy workflows check four email keys.** The deploy stops when
  `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_UNSUBSCRIBE_SECRET` or
  `PUBLIC_RESTAPI_URL` is empty in the host env file.
- **`GET /api/email/health` returns status only ([#423](https://github.com/docs-plus/docs.plus/issues/423)).**
  See Migration.
- **Owner and author profiles drop `status` ([#434](https://github.com/docs-plus/docs.plus/issues/434)).**
  See Security.
- **`GET /health/push` is removed ([#433](https://github.com/docs-plus/docs.plus/issues/433)).**
  It now answers `404`. See Security.

### Migration

Follow these steps in order to upgrade from `2.0.1`. Each step names the
installs it is for. A **scripts install** was built from
`packages/supabase/scripts/`, as
[install step 2](../../docs/self-hosting/install.md#2-prepare-supabase) says.
It has no migration history. A **migration-history install** applies Supabase
migrations with `supabase db push`, as docs.plus production does. The details
for each step follow the list.

1. **Back up** (every install). See
   [Back up your data](../../docs/self-hosting/README.md#back-up-your-data).
   Migrations only go forward.
2. **Read today's email provider** (every install). On the old server, read
   `provider` from `GET /api/email/health`. The new route no longer returns
   it, and step 3 needs it. See Email health.
3. **Edit the host env file** (every install). Set `EMAIL_PROVIDER`,
   `EMAIL_FROM` and `EMAIL_UNSUBSCRIBE_SECRET`, as Email provider shows. The
   new optional keys are `MCP_AUTH_ISSUER`, `RESEND_WEBHOOK_SECRET` and
   `POSTGRES_EXPORTER_DSN`. If `TRAEFIK_CONFIG_DIR` is not set yet, set it, as
   [install step 4](../../docs/self-hosting/install.md#4-point-your-domains-at-the-server)
   says. To see every key change, diff `.env.example` between the two tags.
4. **Apply the Supabase migrations, except the two held ones** (every
   install). Apply the 26 step 4 files in the table below, in timestamp
   order. Do this before the new server starts.
   - Scripts install: apply each file by hand in the Supabase SQL editor, as
     [install](../../docs/self-hosting/install.md#upgrade-to-a-new-release)
     upgrade items 6 and 7 say. Do not run `supabase db push`.
   - Migration-history install: `db push` sends every pending file. So move
     the two held files out of `migrations/` first. Run one `db push`, then
     put the two files back.
   - Before `20260928120000_refuse_connected_app_tokens`, check that the
     `authenticator` role has no other `pgrst.db_pre_request`, as
     [configuration](../../docs/self-hosting/configuration.md#turn-on-the-mcp-connector)
     says.
5. **Deploy** (every install). Build the images and run the database
   migration, as install upgrade items 8 and 9 say. That applies three new
   Prisma migrations: Favorites, the grid preview and Last opened. Then restart
   the apps, as item 10 says. In a rolling deploy, start `hocuspocus-worker`,
   then `hocuspocus-server`, then `rest-api`, and the webapp last.
6. **Run the `document_access` backfill** (every install). Run it right after
   the deploy. Until it runs, the chat of each existing Private document stays
   open. Run it as a dry run first, then with `--apply`. At the repository
   root:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production exec -w /app/apps/hocuspocus.server hocuspocus-worker bun scripts/backfill-document-access.ts
   docker compose -f docker-compose.prod.yml --env-file .env.production exec -w /app/apps/hocuspocus.server hocuspocus-worker bun scripts/backfill-document-access.ts --apply
   ```

   The dry run lists each Private document and its owner. `--apply` writes
   the rows, and a second run is safe.

7. **Check the admin revoke grant** (every install). See Admin revoke.
8. **Set existing media objects private** (installs that store media in S3).
   See Media objects.
9. **Move push gateway probes** (installs that polled `GET /health/push`). See
   Push gateway status.
10. **Turn on the password sign-in hook** (every install). The migration
    `20260928130000_reject_password_sign_in_hook` adds the function. Turn the
    hook on in the Supabase dashboard, as
    [Turn off password sign-in](../../docs/self-hosting/configuration.md#turn-off-password-sign-in)
    says. Keep **Confirm email** on. With it off, a new person's first
    email-link sign-in fails.
11. **Apply the two held migrations** (every install). Wait until the new
    webapp is live and at least 24 hours have passed since the apps shipped.
    Then apply `20261009120500_hide_user_presence_columns` and
    `20261009130100_narrow_channel_insert_grant` together. A scripts install
    applies them by hand. A migration-history install runs one `db push`. Then
    run the checks in User status columns.

**The 28 new Supabase migrations**, in timestamp order:

| Migration                                                       | Step      |
| --------------------------------------------------------------- | --------- |
| `20260904100000_add_content_change_enum_value`                  | 4         |
| `20260904100100_add_document_content_change_carrier`            | 4         |
| `20260904160000_force_digest_for_content_change`                | 4         |
| `20260904180000_add_action_url_to_notifications_summary`        | 4         |
| `20260907153621_add_workspace_member_last_connection_closed_at` | 4         |
| `20260907175946_email_footer_preferences_hash_link`             | 4         |
| `20260908093000_notify_document_title_change`                   | 4         |
| `20260908132041_move_unsubscribe_signing_to_node`               | 4         |
| `20260921120000_chat_mention_token_rule`                        | 4         |
| `20260922120000_system_alert_settings_hash_link`                | 4         |
| `20260928120000_refuse_connected_app_tokens`                    | 4         |
| `20260928130000_reject_password_sign_in_hook`                   | 4         |
| `20260930120000_private_notification_preferences`               | 4         |
| `20260930120100_drop_push_subscriptions_from_realtime`          | 4         |
| `20261001120000_bell_account_wide_system_alerts`                | 4         |
| `20261006120000_push_online_at_and_preference_checks`           | 4         |
| `20261006130000_close_client_write_and_grant_gaps`              | 4         |
| `20261008120000_lock_message_write_columns`                     | 4         |
| `20261008130000_private_document_chat_gate`                     | 4         |
| `20261008140000_port_prod_grant_rls_fix`                        | 4         |
| `20261009115900_scope_heading_channels`                         | 4         |
| `20261009120000_clear_deleted_message_text`                     | 4         |
| `20261009120100_chat_media_read_live_reference`                 | 4         |
| `20261009120200_avatar_buckets_drop_svg`                        | 4         |
| `20261009120300_resolve_mentions_by_user_id`                    | 4         |
| `20261009120400_admin_revoke_admin`                             | 4         |
| `20261009120500_hide_user_presence_columns`                     | 11 (held) |
| `20261009130100_narrow_channel_insert_grant`                    | 11 (held) |

`20261009120500` waits at least 24 hours after the apps ship; see User status
columns. `20261009130100` waits until the new webapp is live
([#402](https://github.com/docs-plus/docs.plus/issues/402)), because an old
tab sends `id` and the narrowed grant refuses that insert.

**Email health ([#423](https://github.com/docs-plus/docs.plus/issues/423)).** Before:
`{ smtp_configured, provider, queue_connected, pending_jobs, failed_jobs, sent_last_hour }`.
After: `{ status, queue_connected }`. Read the provider and the pending count
on `GET /api/admin/email/setup` with an admin token. Read today's `provider`
from `GET /api/email/health` before you deploy, because the Email provider
step needs it.

**Admin revoke ([#412](https://github.com/docs-plus/docs.plus/issues/412)).** Without
`20261009120400_admin_revoke_admin`, every admin revoke answers `500`. After
step 4, check that only `service_role` can run
`public.admin_revoke_admin(uuid)`.

**User status columns ([#434](https://github.com/docs-plus/docs.plus/issues/434)).** Ship the
webapp, this server and the admin dashboard first. Wait at least 24 hours,
then apply the Supabase migration `20261009120500_hide_user_presence_columns`
in step 11. An older webapp tab still selects `status`, so an early migration
breaks its sign-in and its heartbeat. After step 11, check that
`has_column_privilege` is false for `anon` and `authenticated` on
`users.status` and `users.online_at`. Also check that `pg_publication_tables`
has no `users` row.

**Push gateway status ([#433](https://github.com/docs-plus/docs.plus/issues/433)).** If you
polled `GET /health/push`, call `GET /api/admin/push/gateway` with an admin
token. That route always answers `200`, so read the VAPID and queue flags in
the body, not the status code. Move or delete any uptime probe of the old
path, because it now answers `404`.

**Media objects ([#408](https://github.com/docs-plus/docs.plus/issues/408)).** New S3 uploads are
private. Objects written before this release stay `public-read` until you
change them. Deploy the server first, then set the existing objects private.
The key prefix is the server's `NODE_ENV`, for example `production/`:

```
s3cmd setacl --acl-private --recursive s3://<bucket>/production/
```

- First, check that no document names a raw bucket URL. Media behind such a
  URL stops loading after the change.
- A CDN or a bucket policy can still make objects public. The object ACL alone
  does not stop that.
- The route reads with credentials, so private objects keep serving through
  it at every step.

**Email provider.** Before:

```
EMAIL_FROM=notify@example.com
SMTP_HOST=smtp.example.com
SMTP_USER=...
SMTP_PASS=...
```

After:

```
EMAIL_PROVIDER=smtp
EMAIL_FROM=notify@example.com
SMTP_HOST=smtp.example.com
SMTP_USER=...
SMTP_PASS=...
EMAIL_UNSUBSCRIBE_SECRET=<at least 32 characters>
```

- `EMAIL_UNSUBSCRIBE_SECRET` signs the unsubscribe links. Generate it with
  `openssl rand -base64 48`, and never reuse it across environments. A value
  shorter than 32 characters stops the server at boot. When it is empty, mail
  still sends, but its unsubscribe link carries no token, and the route
  refuses that link.
- Set `EMAIL_PROVIDER` to the `provider` value that `GET /api/email/health`
  reports today. Set `EMAIL_FROM` to today's sender: the old `EMAIL_FROM`, or
  `noreply@docs.plus` when it was unset. Any other address changes the From
  line and can break SPF or DMARC alignment.
- A display name is optional, as `"Name <address>"`. A name changes the From
  line that readers see.
- `SMTP_FROM_NAME` was never read. Deleting it changes nothing.
- SendGrid users switch to the SendGrid SMTP relay with `EMAIL_PROVIDER=smtp`,
  `SMTP_HOST=smtp.sendgrid.net`, `SMTP_USER=apikey` and the API key as
  `SMTP_PASS`.
- An old `.env.local` with `SMTP_HOST` and no `EMAIL_PROVIDER` now resolves to
  `invalid`. Add `EMAIL_PROVIDER=smtp`, or clear the SMTP keys to turn email
  off.
- Under `off`, a queued row now settles `skipped` with `email not configured`.
  Before, it failed three times and went to the dead-letter queue.
- An unset `SMTP_SECURE` on port 465 now means a secure connection. Before, it
  meant `false`. `SMTP_SECURE` takes `true` or `false` in any letter case, or
  an empty value.
- `SMTP_USER` and `SMTP_PASS` are now optional. Set both, or neither.

### Added

- **A branded Confirm signup template ([#425](https://github.com/docs-plus/docs.plus/issues/425)).**
  `templates/confirm-signup.html` matches the Magic Link template. Supabase
  sends it to a new account. Before, that mail used the default Supabase
  template, a bare link that Yahoo filed as spam.

- **Admin Email setup page ([#423](https://github.com/docs-plus/docs.plus/issues/423)).**
  `GET /api/admin/email/setup` shows the email status, each problem, and `set`
  or `missing` for each secret. It never returns a secret value. It also runs
  a live connection check and shows the newest bounce, masked, and the email
  DLQ depth. It lists the `.env` lines to add. A test send,
  `POST /api/admin/email/setup/test-send`, mails the signed-in admin's own
  address through `deliverEmail`, once per minute. Without Redis it answers
  `503`. No route writes `.env`.
- **Resend webhook at `POST /api/email/webhooks/resend` ([#422](https://github.com/docs-plus/docs.plus/issues/422)).**
  Resend now reports delivery events back to the server. A permanent
  bounce, a complaint or a suppression writes one `email_bounces` row through
  `record_email_bounce`, which turns email off for that person. An
  `email.failed` event writes nothing. It logs an `operator` error, so
  `incident-email-operator` fires. The route checks the Svix signature over
  the raw body, with a 5-minute clock window. It records each `svix-id`
  once, so a redelivery writes nothing. An event from another environment's
  `ns` tag is ignored. The route exists only when `RESEND_WEBHOOK_SECRET` is
  set to a valid secret; otherwise it answers 404. An invalid secret logs
  `email webhook secret invalid` and never holds mail. A new warning alert,
  `incident-email-webhook-unauthorized`, fires on more than 50 rejected
  signatures in 10 minutes. `POST /api/email/bounce` now writes through the
  same function.

- **MCP connector at `/api/mcp`.** A person connects docs.plus to Claude or
  ChatGPT and signs in as themselves through the Supabase OAuth server. The
  server is stateless, one MCP server per request, on
  `@modelcontextprotocol/server` `2.0.0`. Ten tools: `find_documents`,
  `create_document`, `get_outline`, `read_document`, `append_to_document`,
  `edit_blocks`, `replace_text`, `list_chat_rooms`, `read_chat_thread` and
  `post_chat_message`. Each tool except `find_documents` and
  `create_document` takes a slug and checks the caller's access before
  it reads or writes. Writes and chat posts work only in documents the caller
  owns. Reads
  stop at 100 000 characters and say so, hide media URLs, and frame the text
  as data. A post removes every `@`, so it sends no mention. Each person
  gets 60 calls a minute. Set `MCP_AUTH_ISSUER` to the Supabase issuer.

- **A connected app edits in place, never a heading, never media.**
  `replace_section` is gone. A section read numbers each block. `edit_blocks`
  inserts, replaces or removes whole blocks at one numbered position. It
  refuses to remove a block that holds a picture, video, embed, upload or file
  link. A new heading goes only at the end of the section. It must be deeper
  than the section heading and no shallower than the next heading, so it never
  takes over the subsections after it. `replace_text` changes one exact piece
  of text inside one paragraph, list item or table cell, and keeps its
  formatting. It never changes the name of an attached file. Neither tool
  touches the heading, and both refuse a stale `rev`. `replace_text` returns
  the new `rev`. `edit_blocks` does not, because it renumbers blocks, so the
  agent reads again. The internal hop modes are now `replace`, `append`,
  `blocks` and `text`. The old `section` mode is gone. So during a rolling
  deploy, an older replica refuses a new edit instead of replacing a whole
  section. ChatGPT keeps the tool list it saw when it connected: press
  **Refresh** on the docs.plus app.

- **`create_document` and server instructions.** A connected app makes a
  document, and the caller owns it. An anonymous caller is refused. A taken
  slug gets a suffix. A title whose slug is a webapp page, such as "Privacy",
  gets `-document`. One transaction writes the document and version 1, with
  `trigger: "mcp"` and the caller as `triggeredBy`. So refused text or a
  failed write leaves no document. The new-document notice mail is sent after
  the reply. The server's `instructions` tell the agent to use these tools,
  not a browser. Without them, claude.ai and ChatGPT opened docs.plus in a
  browser to make a document, and that document got another owner.

- **`GET /api/connected-apps/redirects`** returns the registered redirect
  URIs of the caller's own connected apps. Supabase grants omit them, and the
  webapp needs them to tell the real Claude and ChatGPT from an app that only
  borrows the name. It reads the grants with the caller's token. Any failure
  answers an empty map.

- **Tool hints follow the MCP and OpenAI definitions.** Read tools set
  `destructiveHint: false`. Write tools set `openWorldHint: true`, because a
  write to a public document publishes. `post_chat_message` only adds, so it
  is not destructive, but room members who follow every message and are away
  get a notification. Its description says so. The server info carries
  `title` and `websiteUrl`.

- **`GET /api/admin/mcp/usage` counts MCP tool calls.** Each call adds to
  three Redis keys a day: calls per tool and outcome, calls per `client_id`,
  and distinct callers. The keys expire after 35 days. The route takes `days`
  from 1 to 35 and groups calls by app name. It returns no user id, email or
  client id. A Redis fault never fails a tool call. The admin dashboard shows
  it on the MCP Usage page.

- **A validation `400` names each rejected input.** `error.fields` holds one
  `{ path, message }` per field.

- Public `POST /api/email/validate`. Body is `{ email }`. Both answers are
  200 `{ isValid }`. A bad body is the house envelope.

- **Pad title rename posts a workspace-chat notice.** A successful
  `PUT /api/documents/:documentId` that changes `title` on an existing row
  calls `notify_document_title_change` after the Prisma write. The call is
  detached and never rejects, so a hung or missing RPC cannot fail the
  rename. A create, an unchanged title, an empty title, or a signed-out
  rename posts nothing.

- Mention, everyone, and regular-message INSERT triggers skip
  `type = notification`. A Pad title notice cannot mail or write inbox
  rows.

- **Markdown import keeps playable media.** A paragraph that is only a media
  URL becomes that media node (`video`, `audio`, and the six embeds). A typed
  `![youtube](url)` (and the same for the other block media nodes) is lifted
  out of its paragraph so `PATCH /content` accepts the JSON. Filter links,
  labeled links, and a media URL inside a list item stay links. Picture size
  is still empty on the import JSON; Settings replace writes natural width
  and height in the browser.
- **Content-change notifications reach a private document's owner alone.** A
  save fans out on every commit, and the worker decides the audience.
  Supabase cannot decide it, because `isPrivate`, `ownerId` and `deletedAt`
  live in Prisma. Workspace membership also admits any signed-in visitor. A trashed document reaches
  nobody. A private document with no owner reaches nobody. The rule is checked
  again at send time, because a document can turn private after the carrier row
  is written. A `content_change` always takes the digest branch, never the
  immediate one, which has no privacy re-check. A digest left with nothing to
  say marks its `email_queue` rows `'skipped'` rather than mailing an empty
  page. The daily email cap now counts immediate rows only. One digest marks
  one row per notification, so counting every row read a 60-notification
  digest as 60 emails. That loosens the cap for existing daily and weekly readers, on
  purpose.
- **Content-change followers, in the database.** A new `notification_category`
  value, `content_change`, carries "this document changed" on
  `public.notifications`. The subscription is workspace membership itself, so
  there is no new table. `workspace_members.content_email_muted_at` holds the
  whole state. `NULL` means following, while `left_at` is also `NULL`.
  `notify_document_content_change` is the service-role fan-out. It writes one
  carrier per eligible follower and skips editors, muted members, and anyone
  already holding an unread carrier from the last 24 hours. It writes nothing
  else: a document no signed-in person has ever opened has no `workspaces` row,
  so it reaches nobody, the owner included. `set_document_follow` and
  `get_document_follow_state` are the browser-facing pair, both gating on
  `auth.uid()`. Push defaults off for this type and needs an explicit opt-in;
  email defaults on. Two migrations ship it, because Postgres forbids using an
  enum value added in the same transaction.
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
  A section that keeps its text and its `toc-id` but changes place is `moved`.
  `summary.sectionsMoved` counts them, and a `moved` section makes `changed` true. An
  insertion does not mark later sections `moved`. On a very large outline the route
  reports no `moved` section. A section can also carry `removedExcerpt`, the text that
  left, and `runs`, the ordered `same`, `removed` and `added` text around the edit.
- **Owner-only Favorite.** `PUT /api/documents/:documentId/favorite` accepts
  `{ favorite: boolean }` and writes a `DocumentFavorite` join for `token.sub`
  (`userId` + `documentId`). Migration `20260901100000_add_document_favorites` adds the
  table. Soft-deleted documents are `404`. Soft-delete of the document keeps the join, so
  restore stays favorited. Purge cascade-drops the row.
- **Owner live lists pin Favorites first.** `GET /api/documents?ownerId=token.sub`
  returns `isFavorite` and orders that user's Favorites first, then `sort`. Another user's
  Favorite never pins a row. Trash and the public fleet omit both.
- **DocumentGridPreview.** `DocumentMetadata.preview` JSON. SQL NULL means never
  extracted. `{ heading: null, lines: [] }` means empty or a failed extract.
  Heading is stored even when it equals Title. The paper omits heading at paint
  when it equals Title. Owner live list and Owner Trash list include `preview`
  and fill SQL-NULL rows. Fill persists with `Promise.all` after decode and
  returns a Map. `refreshDocumentGridPreview` always replaces. The owner list
  mapper runs `parseDocumentGridPreview`. SQL NULL stays null. Invalid JSON
  becomes `{ heading: null, lines: [] }`. Fleet, create, slug GET, and update
  omit `preview`. Persist uses raw SQL so `@updatedAt` does not move. Worker
  refresh runs after the persist transaction commits. Type lives in
  `src/lib/documentGridPreview.ts`. Do not reuse admin `DocumentPreview`.
- **Last opened.** `DocumentMetadata.lastOpenedAt`. Sort key `lastOpenedAt_desc`.
  Owner live list and Owner Trash list include it. Fleet, create, slug GET,
  and update omit it. `POST /api/documents/:documentId/opened` is owner-only,
  raw SQL, 30-second debounce, trash → 404. Does not move `@updatedAt`.
- **`history.list` takes `since`.** A first page sent with `since` carries
  `anchor`, the newest version at or before that instant. When retention
  removed every such row, `anchor` is the oldest surviving row. `anchor` is
  never added to `versions`. List and watch replies and failures echo the
  request's `since`, `version` and `beforeVersion`.
- **Admin digest settings.** `GET` and `PUT /api/admin/email/digest-grouping`
  read and write `{ grouping, maxKb }`. `grouping` is `document` (one mail per
  document) or `aggregate` (one combined mail). `maxKb` is the HTML size the
  digest fit works toward, a JSON integer from 10 to 102. A `PUT` body needs at
  least one of the two. A bad body is the house envelope, `400` with code
  `VALIDATION_ERROR`. The values live in the Redis keys `email:digest-grouping`
  and `email:digest-max-kb`. A missing or bad value, or no Redis, reads as
  `document` and 90 KB. `PUT` answers `503` when Redis is not available. The
  worker reads both values when it builds each digest.
- **The change digest is a document sheet.** `buildDigestEmail` walks the
  documents once (`walkDigest`). HTML and plain text only paint that block
  list, so a View link cannot exist on one part and vanish from the other.
  The shell is the shared mail frame with `frame: 'sheet'` (gray well, about
  960px). Other mail stays the card frame. The sheet top bar is the mark, the
  title, a bell, and the reader face. The mark and the title open the
  document. The bell opens `#notifications` on the first document. There is
  no greeting and no View-all button. A status bar on each document holds the
  change-window line and the signed footer links. Under a heading, notices
  come first, then the passage. A notice with no preview text reads "media".
  Heading chats stay `DigestNotification` rows. A chat whose channel is not a
  heading stays as the same notice row. A removed heading's chat stays in
  that channel. A heading with no change and no new heading chat stays out.
  The heading row has no Chat or View link. The subject counts every chat
  line, under a heading or in a leftover channel, plus one per Change digest
  block.
- **The digest fit works toward `maxKb`.** It measures the HTML with the real
  unsubscribe footer. It drops the oldest chat first, then shortens one
  passage, but only in a context run after an edit. Change runs stay whole, so
  a mail can still go over `maxKb`. The fit drops a heading only when the
  heading came in for its chats alone and no chat is left.

- **Alerts for Redis down and a missing replica.** `dep-redis-down` pages
  when `redis_up` is 0 for 1 minute, because a Redis outage pauses every
  save with no other signal. `infra-replica-missing` pages when a job has
  fewer than 2 replicas up for 5 minutes. A lost replica's `up` series
  vanishes, so the target-down rule cannot see it.

- **`GET /api/documents` takes `scope=all|owned|joined`.** Settings →
  Documents uses it to list owned and joined documents together. A joined
  document is one the caller opened while signed in and does not own. An
  ownerless document counts. The server reads the caller's memberships from
  the token through the service role, so the client never sends ids. A
  private or deleted document the caller does not own is never listed. Only
  the caller's own Favorites pin first. A row the caller does not own sorts as
  never opened and never carries `lastOpenedAt`. `scope` needs a `token`
  (`401` without one) and refuses `deleted=true` (`400`). A failed membership
  read answers `503 SERVICE_UNAVAILABLE`, never an empty list. Deploy this
  server before the webapp.

- **Every admin write logs its actor.** `adminAuthMiddleware` writes one
  `Admin action` line per non-GET admin request, with `actorId`, `method`,
  `path`, `status` and `requestId`. The request logger has no user
  ([#404](https://github.com/docs-plus/docs.plus/issues/404)).

- **Last left and document occupancy.** The collaboration server keeps one
  Redis sorted set per document, `doc-occupancy:<documentId>`. It holds each
  visible socket of a signed-in person. The pad sends a stateless
  `{ msg: 'reading', visible }` message after each sync, and again when its
  tab is shown or hidden. A visit counts after 10 s in view. When a socket
  that counted closes, the server stamps Last left through the service-role
  RPC `mark_document_connection_closed`, from migration
  `20260907153621_add_workspace_member_last_connection_closed_at`. That
  column, `workspace_members.last_connection_closed_at`, only moves forward.
  The content-change fan-out skips each person in the set. A failed or empty
  read skips nobody, so the fan-out notifies rather than mutes. Both features
  need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Changed

- **Admin routes are ready for an `sb_` secret key.** `supabaseRest` sent
  the service-role key both as `apikey` and as a Bearer token. An `sb_` key
  is not a JWT, and Supabase says to send it on `apikey`, not as a Bearer
  token. An `sb_` key now goes on `apikey` only. A legacy JWT key still
  sends both headers.
- **The REST edge probe moved to `/health/live` ([#210](https://github.com/docs-plus/docs.plus/issues/210)).**
  Traefik now probes `/health/live`, which calls no dependency. A Redis fault
  no longer takes both REST replicas out of the pool. `/health` keeps the
  dependency check and its `503`. Its three checks run at the same time, each
  with a 2 s deadline.
- **The revert cooldown and the retention sweep are fleet-wide.** The revert
  cooldown, one revert per document every 2 s, now lives in Redis. Without
  Redis, each process keeps its own cooldown. The retention sweep runs under a
  Redis lease, so one worker replica runs each pass. Public media reads also
  get their own rate limit, 10 times `RATE_LIMIT_MAX`. So a document's
  pictures no longer spend the global rate limit.
- **The server signs unsubscribe links.** `src/lib/unsubscribeToken.ts` signs
  and checks each footer token with `EMAIL_UNSUBSCRIBE_SECRET`. Before,
  Postgres signed them with `app.unsubscribe_secret`, which a hosted Supabase
  project cannot set. So every footer link had no token, and the route
  refused it. Migration `20260908132041_move_unsubscribe_signing_to_node`
  drops the SQL signer and keeps `apply_unsubscribe`, the write. Set the
  secret as Migration step 3 says.
- **Email retries only what time can fix ([#421](https://github.com/docs-plus/docs.plus/issues/421)).**
  A failed send is now `transient`, `permanent` or `operator`. A transient
  failure makes up to 6 attempts with a 30 s exponential backoff, about 15
  minutes in all. Before, it was 3 attempts in about 15 seconds. A permanent
  or operator failure goes to the dead-letter queue at once, with
  `failureKind` and `failureCode`. `scripts/drain-email-dlq.ts` replays
  operator entries and fresh transient ones, and discards permanent ones. It
  is a dry run unless you pass `--apply`. A Resend send times out after 15 s.
  SMTP takes no deadline, so it sets a 30 s socket timeout instead. Resend
  mail carries the tags `job_id`, `email_type` and `ns`. Email log lines mask
  every address. Two new alerts fire: `incident-email-operator` (critical)
  and `incident-email-transient-surge` (warning).

- **Email providers sit behind one small contract ([#419](https://github.com/docs-plus/docs.plus/issues/419)).**
  `src/config/email.ts` resolves the config once, as `ready`, `off` or
  `invalid`. Providers read `config.email.delivery`, never `process.env`. The
  worker `/health` adds `workers.email.configStatus`. Under `invalid`, the held
  email consumer no longer fails it. A queued Resend send carries an `Idempotency-Key` built from the
  job id. A pgmq email message older than 24 hours settles `skipped` with
  `stale`. The `Email job completed` line now carries `messageId`. The new
  `incident-email-config-invalid` alert pages on `email config invalid`.

- **`GET /changes` sections show only real edits, and name media and level
  changes ([#448](https://github.com/docs-plus/docs.plus/issues/448)).** A
  `runs` list never holds only `same` and `gap` runs. An edit that changes
  only whitespace or invisible marks gives no `runs`. Those marks are U+00A0,
  a zero-width space, non-joiner or joiner, a word joiner, a bidi mark (LRM,
  RLM or ALM) and U+FE0F. The excerpts are cleared with the `runs`. An excerpt with no visible text is left out. An added or removed image, video or embed reads `image`,
  `video` or `embed` in `runs` and in a whole section's excerpt. A new
  optional `previousLevel` holds the baseline level of a `modified` heading
  whose level changed. Word counts do not change. A section measure that
  throws now logs at warn.
- **Admin notification stats read `users.notification_preferences`.** Apply
  the Supabase migration `20260930120000_private_notification_preferences`
  before you deploy this server (Migration step 4).
- The unsubscribe page follows the device's dark mode.

- **A connected app's token works only at `/api/mcp`.** A token that carries
  a `client_id` claim comes from the OAuth flow. Admin routes and every other
  signed-in route answer `403`, an optional route treats it as signed out, and
  the WebSocket refuses it. A browser session token is unchanged.

- **`/api/mcp` names its scopes: `openid email profile`.** The `401`
  `WWW-Authenticate` header carries `scope`, and the resource metadata carries
  `scopes_supported`. Claude asks for these scopes, plus `offline_access`, so
  it no longer asks for `phone`. An existing grant keeps its old scopes until the person
  reconnects. ChatGPT still asks for every scope Supabase lists, `phone`
  included. No account holds a phone number, because phone sign-up is off, so
  this pin is defense in depth. The server info also carries a `description`.

- **`test:e2e:duplicate-media` forces local storage from the package script.**
  The storage backend is now picked once from validated config, which freezes at
  import, so the script's own `process.env` assignment would land too late. Run
  the script through `bun run test:e2e:duplicate-media`, never `bun` directly, or
  its purge deletes by prefix from the bucket named by `DO_STORAGE_ENDPOINT`.
- **`history.list` returns one page.** A page holds up to 50 rows, newest
  first, with `hasMore`. When `hasMore` is true, the reply carries
  `nextBefore`. Send it back as `beforeVersion` to get the next older page,
  whose `response` carries that `beforeVersion`. A client that ignores `hasMore` sees only the
  newest page.
- **`history.watch` has a per-connection rate limit.** Past it, the server
  answers `history_failed` with reason `rate-limited`, as `history.list`
  already does for its cooldown.

- **`realtime-doc-persist-stalled` pages on edits that do not save**, not on
  open sockets. Readers who never type no longer page it. It stays
  fleet-wide, because both replicas count a relayed edit and only one saves
  it. The runbook now checks Redis first and restarts one replica last.
- **`worker-queue-backlog` pages on any backlog held for 10 minutes**, not only
  one above 100 jobs.
- **Traefik runs with 1.0 CPU and 512M.** At 33 people in one document it hit
  its 0.5 CPU limit and was 83% throttled.

### Fixed

- **The sign-in templates state the real expiry ([#425](https://github.com/docs-plus/docs.plus/issues/425)).**
  `templates/magic-link.html` and `templates/change-email-address.html` said
  the link expires in 15 minutes. Production expires it after 3600 seconds, so
  both now say 1 hour.
  The footers drop the fixed `2026`, because Supabase templates have no date
  variable. The Magic Link and Confirm signup footers name the reader's
  address with `{{ .Email }}`.

- **The unsubscribe link asks before it changes anything ([#445](https://github.com/docs-plus/docs.plus/issues/445)).**
  `GET /api/email/unsubscribe` now checks the token and shows an Unsubscribe
  button. It writes nothing, so a mail link scanner can no longer unsubscribe
  a reader. The button posts `confirm=yes` to the same URL, and that post
  writes. One-click unsubscribe from a mail client is unchanged. Links in
  mail already sent still work, and they now open the confirm page.
- **Without Redis, a failed mail is no longer sent twice ([#421](https://github.com/docs-plus/docs.plus/issues/421)).**
  The service sent again after an inline failure. Now an inline failure is
  final: the row settles `failed`, and the pgmq message is acked. A skipped
  inline send no longer reports success to `/send-generic` and `/send-digest`.
- **A late `stale`, `skipped` or `failed` settle no longer overwrites a `sent`
  row ([#421](https://github.com/docs-plus/docs.plus/issues/421)).** A pgmq
  redelivery after the mail went out could mark it `skipped`.
- **The Notifications DLQ table shows a Reason ([#421](https://github.com/docs-plus/docs.plus/issues/421)).**
  A dead-letter job never fails itself, so its BullMQ `failedReason` was
  always empty. `GET /api/admin/audit/notifications/dlq` now reads the reason
  from the entry. It also returns a summary with a masked `to`, not the whole
  job, which held the raw address and the mail body.

- **A mail queued without an id could be skipped as already sent ([#419](https://github.com/docs-plus/docs.plus/issues/419)).**
  BullMQ counter ids restart after a Redis reset, but the sent log keeps
  `email:<id>` for 7 days. `queueEmail` now gives such a job a UUID. pgmq
  notifications and digests already passed stable ids. So this fix reaches
  only the service-role `/send-generic` and `/send-digest` routes, and a
  notification with no `queue_id`.
- **`/send-generic` now sets the Reply-To header ([#419](https://github.com/docs-plus/docs.plus/issues/419)).**
  The route accepted `replyTo` but dropped it, so the mail had no Reply-To
  header. The generic send now passes it to the provider.
- **A retry renders the same body.** The unsubscribe token now takes its time
  from the job's `created_at`, not the clock.
- **SMTP works without a user and a password.** So local dev mail can reach
  the Supabase mail catcher at `http://localhost:54324`. ENV.md, section Email,
  lists the lines to set in `.env.local`.

- **A content write to a cold document waits for its own commit ([#229](https://github.com/docs-plus/docs.plus/issues/229)).**
  Each document has a per-document lock, and a `200` carries the saved
  `version`. A save that cannot be confirmed in 20 s answers `503` with
  `SAVE_NOT_CONFIRMED`. When earlier writes still hold the lock, the answer
  is `503` with `DOCUMENT_BUSY`, and nothing is applied.
- **A chat push opens the message.** The worker builds
  `/<slug>?chatroom=…&msg_id=…`, because the queued row has no link.

- **A signed-in first edit that creates the row owns it.** The slug→documentId
  anchor stamps the editor's `ownerId` and `email`, then broadcasts
  `{type:'owner'}` to the room. A signed-out or anonymous editor leaves the row
  ownerless. A `P2002` cede never claims a row. When the anchor fails, or cedes
  the slug to another id, the worker's no-row backstop creates the row. It
  stamps the editor that the save carries and sends no live event. A direct
  connection needs a metadata row, so it never reaches that create. The worker
  `update: {}` arm is unchanged.

- **ODT export and portable JSON no longer read an array as a node.** The shared
  `isRecord` guard accepted arrays, so a `content` array could reach a branch
  meant for a node. No shipped document is known to have hit it.

- An unknown history `type` is refused with `history_failed`.

- **The digest plain-text part uses the HTML caps.** A channel card shows 5
  lines and an 80-character preview. Before, the plain text showed 3 lines and
  50 characters.

- **`APP_URL` is read once, as `config.email.appUrl`.** A trailing `/` is
  trimmed, and an empty value falls back to `https://docs.plus`. Email links
  no longer get `//` when `APP_URL` ends in `/`. When `APP_URL` is `''`, a
  push link now starts with `https://docs.plus`, not a bare `/<slug>`.

- **An awareness frame over 64 KiB is refused before it applies.** The
  refusal closes that document connection and counts in
  `ws_awareness_frames_dropped_total`. The budget fits about 120 people.
- **Alerting counters start at 0.** A labelled series did not exist before
  its first increment, so `increase()` missed the first lost save after each
  deploy. The WS and worker processes now seed their alerting series on
  startup.

- **Push reaches Chrome, Android, Edge, Brave and Opera again.** `isSafeUrl`
  ran the IPv6 range rules on hostnames, so `fcm.googleapis.com` counted as
  private. From 2026-08-09 the sender refused every such device and switched
  it off. The range rules now run on IP literals only, and
  `resolvesToPublicAddress` still checks a hostname after DNS
  ([#398](https://github.com/docs-plus/docs.plus/issues/398)).
- **The push sender keeps a device on after a refusal or an outage.** An SSRF
  refusal skips the send and leaves the row alone, because the refusal can
  come from our own filter. A row that the URL filter refuses is not a failed
  delivery, so it no longer makes the job retry and dead-letter. A row that
  the DNS check refuses still counts as a delivery attempt, so the job
  retries when no other row succeeds. It adds nothing to `failed_count`. A
  `429`, a `5xx` or a network error no longer raises `failed_count`. Any
  other error with no status, such as a bad subscription key, still adds 1.
  `last_error` records `HTTP <code>`, `Network error` or `Send error`. Each
  send carries a 1-day TTL and a 10 s timeout
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **A purged document id stays gone.** `PUT /api/documents/:docId` answers
  `404` for a purged id and no longer creates its row again. The WebSocket
  gate reads the purge tombstone even when a row exists
  ([#407](https://github.com/docs-plus/docs.plus/issues/407)).
- **`online_at` follows the status heartbeat.** `update_user_online_at` now
  stamps it on every status write. It changed only with the status, so an
  active person looked offline after 2 minutes. Apply the Supabase migration
  `20261006120000_push_online_at_and_preference_checks` (Migration step 4)
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **`update_notification_preferences` refuses a value the push and email
  triggers cannot cast.** It answers `22023` `invalid_preference_value` and
  names the key. A bad value used to abort message inserts. The same
  migration carries it
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).

### Security

- **Known gap: MCP titles outside the data frame ([#457](https://github.com/docs-plus/docs.plus/issues/457)).**
  The connector frames document and chat text as data. `find_documents` does
  not frame titles. With `scope: 'public'`, it can show other owners'
  document titles outside the data frame. `get_outline` and `list_chat_rooms`
  also repeat heading titles unframed, in `structuredContent`. This release
  ships with the gap. The fix is planned with
  [#456](https://github.com/docs-plus/docs.plus/issues/456) for the next
  release.
- **Logs redact nested tokens.** Pino matched top-level keys only. So a
  nested `Authorization` header, and an `access_token` or `refresh_token`
  nested in an OAuth body or an error, were logged in clear. The redact paths
  now cover them.
- **Push gateway status needs an admin token ([#433](https://github.com/docs-plus/docs.plus/issues/433)).**
  `GET /health/push` showed queue counts and the VAPID subject with no auth. Admins read the same status on
  `GET /api/admin/push/gateway`. That route always answers `200` with the
  status, even when push is not set up. `GET /api/email/health` stays public,
  because it already returns status only ([#423](https://github.com/docs-plus/docs.plus/issues/423)).
- **A heading chat belongs to its own document ([#402](https://github.com/docs-plus/docs.plus/issues/402)).**
  The MCP chat tools find a room by the document and the heading's
  `section_id`, then read and post by that room's channel id. A channel row
  that another document holds is never read or posted to. The change digest
  places a heading chat by `heading_id`. Migration
  `20261009115900_scope_heading_channels.sql` adds that column. Apply it
  before this deploy (Migration step 4).
- **Media of a document in Trash stops serving ([#408](https://github.com/docs-plus/docs.plus/issues/408)).**
  `GET /api/plugins/hypermultimedia/:documentId/:mediaId` answers `404`
  `NOT_FOUND` while the document is in Trash. After Restore, it serves again.
  A document with no metadata row still serves. Media that a live document
  names under the prefix of a document in Trash also stops serving until
  Restore. Older duplicates and pasted images can name another document's
  prefix. New S3 objects are no longer `public-read`, so every public read goes
  through the media route. A duplicate no longer copies media whose prefix
  document is in Trash. That media becomes a missing image in the copy.
  Copies already in a browser cache stay until their one-year `immutable`
  entry expires. See Migration for existing objects.

- **Supabase refuses a connected app's token on the Data API, Storage and Realtime.** Apply
  the migration `20260928120000_refuse_connected_app_tokens` (Migration step
  4). A new install gets it from
  `packages/supabase/scripts/31-connected-app-token-gate.sql`. The Data
  API answers `403` with the code `connected_app`. Storage and Realtime refuse
  the token too. The MCP tools use the service-role key, so they still work.
  Check the existing `pgrst.db_pre_request` first, as
  [configuration](../../docs/self-hosting/configuration.md#turn-on-the-mcp-connector)
  says. The Supabase Auth API has no such check, so also turn on the password
  sign-in hook below. In production, turn on Secure password change too, as
  [configuration](../../docs/self-hosting/configuration.md#turn-off-password-sign-in)
  says ([#441](https://github.com/docs-plus/docs.plus/issues/441)). The local
  `packages/supabase/config.toml` now sets `secure_password_change = true`. A
  running local stack takes it after a Supabase stop and start.

- **Supabase can refuse every password sign-in.** docs.plus does not use
  passwords. `packages/supabase/scripts/32-password-sign-in-hook.sql`, paired
  with the migration `20260928130000_reject_password_sign_in_hook`, adds
  `public.hook_block_password_tokens`. As the Custom Access Token hook, which
  every Supabase plan has, it refuses a token for a password sign-in with
  "Invalid login credentials". Google and email-link sign-in do not change.
  Confirm email must stay on. The operator turns the hook on, as
  [configuration](../../docs/self-hosting/configuration.md#turn-off-password-sign-in)
  says. It stays off on the local stack.

- **Outside development, `getErrorResponse` answers every 5xx with `Internal server error`.**
  The `code` is unchanged, and the server logs the original. A Prisma or
  Supabase message used to reach production `500` responses. A handler that
  calls `fail()` keeps its own fixed message, which never carries driver text.
  Five admin routes now answer a `500` with a fixed message and log the
  Supabase error. They are resend confirmation, toggle admin, list admins,
  list media storage and delete ghost account. The media storage export cap
  still answers `400` with its own message
  ([#413](https://github.com/docs-plus/docs.plus/issues/413)).

- **REST health checks are cached, and their bodies carry no error text.**
  Each database, Redis and Supabase check is cached for 5 s per process. A
  `/health` flood then costs at most one call per dependency every 5 s on
  each replica. A failed check no longer returns driver error text. The
  server logs the reason instead. The `rest-api` container healthcheck now
  reads `/health/database`, so a Redis stall no longer marks both replicas
  unhealthy and drops every `/api` route
  ([#405](https://github.com/docs-plus/docs.plus/issues/405)).

- **Service-role functions refuse `public`, `anon` and `authenticated`.** The
  Supabase migration `20261006130000_close_client_write_and_grant_gaps`
  revokes them. It also moves the three `28-ghost-accounts-audit.sql`
  functions into a migration. Production already held these revokes, so a
  fresh deploy now matches it
  ([#397](https://github.com/docs-plus/docs.plus/issues/397)).
- **Clients no longer update `channels` or write `workspaces`.** The same migration
  revokes UPDATE on `channels`, so the channel-wide mute is no longer
  client-writable. The per-user mute on `channel_members` is unchanged. It
  revokes INSERT and UPDATE on `workspaces`, and `join_workspace` is the only
  writer ([#401](https://github.com/docs-plus/docs.plus/issues/401),
  [#409](https://github.com/docs-plus/docs.plus/issues/409)).
- **A reply stays in its channel, and Bookmarks show only readable
  messages.** `set_replied_message_preview` refuses a parent from another
  channel. `get_user_bookmarks` returns only messages the caller can read.
  Clients no longer write `message_bookmarks`; the bookmark RPCs do. The
  same migration carries all three
  ([#410](https://github.com/docs-plus/docs.plus/issues/410)).
- **A Private document's chat opens only for its owner.** The Supabase
  migration `20261008130000_private_document_chat_gate` adds
  `public.document_access`, a copy of the Private flag and the owner. Chat
  reads, sends, edits, media, read receipts, `join_workspace`, notifications
  and unread counts check it. A missing row means public. The same migration
  makes `purge_document_footprint` delete the row, so a purged document leaves
  no Private flag or owner behind. A restore of a Private document writes the
  row first, so a restore after a partial purge does not open its chat. A
  failed write answers `503`, and the document stays in Trash.
  `PUT /api/documents/:docId` and `PATCH /api/admin/documents/:id` write the
  row with the service role on every Private change. A failed write answers
  `503 SERVICE_UNAVAILABLE` on the PUT and `500` on the admin route, so the
  caller can retry. Both failures fail closed. When Private turns on, the row
  is written before the Prisma write, so a failed write leaves the document
  public and changes nothing. When Private turns off, the row is written after
  the Prisma write, so a failed write leaves the chat closed. If the Prisma
  write fails after the row write, the chat stays closed on a public document.
  A retry that carries `isPrivate` repairs either case. The backfill does not.
  Apply `20261006130000_close_client_write_and_grant_gaps` first, because the
  bookmark panel gate lives there. Then apply this migration, deploy this
  server, and run `scripts/backfill-document-access.ts`, as Migration steps 4
  to 6 say. Until the backfill runs, Private documents' chat stays open
  ([#396](https://github.com/docs-plus/docs.plus/issues/396)).
- **A picked chat mention notifies the user it was picked for.** A username
  change no longer sends it to the next holder of that name. A typed `@name`
  still notifies the current holder of that name. The Supabase migration
  `20261009120300_resolve_mentions_by_user_id` carries the fix. Apply it
  before this deploy (Migration step 4) ([#415](https://github.com/docs-plus/docs.plus/issues/415)).
- **A local media purge refuses an id that is not one path segment.** On a
  server with `PERSIST_TO_LOCAL_STORAGE=true`, a crafted document id could
  reach another document's media folder, or a folder outside the storage root.
  The purge now logs a warning and deletes nothing for such an id. The
  WebSocket room name and `PUT /api/documents/:docId` now refuse an id outside
  `[A-Za-z0-9_-]`, 1 to 100 characters. The PUT answers `400`, and the
  WebSocket counts `ws_auth_rejections_total{reason="invalid-document-id"}`
  ([#426](https://github.com/docs-plus/docs.plus/issues/426)).
- **A signed-in WebSocket closes when its access token expires.** At the
  token's `exp`, the server closes the socket with code `4408`. The webapp
  reconnects with a fresh token, so `onAuthenticate` checks the identity again.
  In production, a token already past `exp` is refused like an invalid one.
  Each signed-in tab
  reconnects about once per token lifetime, which is 1 hour by default
  ([#430](https://github.com/docs-plus/docs.plus/issues/430)).
- **Production jobs run only from `main`, and Traefik reads a copy of its config.**
  A manual `CI/CD Production` or `CI/CD Observability` run from another
  branch now skips every job on the production runner. `docker-compose.prod.yml`
  mounts Traefik's config from `${TRAEFIK_CONFIG_DIR:-./scripts/traefik}`. The
  production deploy copies `scripts/traefik/` to
  `/opt/projects/prod.docs.plus/.deploy/traefik` before `up -d traefik redis`. Set
  `TRAEFIK_CONFIG_DIR=/opt/projects/prod.docs.plus/.deploy/traefik` in the host
  `.env` before that deploy. Traefik then recreates once, so deploy in a quiet
  window. Staging keeps the default. A self-hoster copies `scripts/traefik/`
  outside the clone and sets `TRAEFIK_CONFIG_DIR` to that copy, as
  [install step 4](../../docs/self-hosting/install.md#4-point-your-domains-at-the-server)
  says ([#437](https://github.com/docs-plus/docs.plus/issues/437)).
- **Monitoring containers get less access
  ([#443](https://github.com/docs-plus/docs.plus/issues/443)).** Alloy no
  longer mounts the Docker socket. It reads the Docker API through
  `docker-socket-proxy`, with GET only and events off. A tmpfs hides the host
  socket from node-exporter. `postgres-exporter` reads `POSTGRES_EXPORTER_DSN`,
  a read-only `pg_monitor` login, when it is set. Otherwise it falls back to
  `DATABASE_URL`.
- **The ghost-account delete checks each account again before it deletes
  ([#412](https://github.com/docs-plus/docs.plus/issues/412)).**
  `DELETE /api/admin/audit/ghost-accounts/:id` answers `409` when the user
  signed in after the list loaded, is an admin, or does not exist. A non-uuid
  id answers the house `400`. The bulk delete counts a refused id under `failed`.
  A failed impact read or admin read now deletes nothing. Before, a failed
  impact read could fall through to a hard delete. Revoking admin access is one
  locked call to `public.admin_revoke_admin`, so two revokes at the same moment
  cannot leave zero admins. See Migration.
- **A soft delete clears the public profile
  ([#427](https://github.com/docs-plus/docs.plus/issues/427)).** When a
  ghost-account delete keeps the row, it now clears the name, photo, bio and
  links. It sets the username to `deleted_` plus the first 12 hex characters
  of the id, and removes the user's `user_avatars` objects. Messages keep their
  author, who shows the placeholder name and the default avatar.
- **Owner and author profiles no longer carry `status`
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)).** This covers
  the `ownerProfile` on `GET /api/documents/:docName`, the documents list
  `owner`, and the `history.list` profiles. Anyone could read the first of
  these without signing in. No client read the field.

### Removed

- The SendGrid provider. `SENDGRID_API_KEY` stays in the schema only so that
  a leftover key reads `invalid`.
- `SMTP_FROM_NAME`. Nothing ever read it, so its removal changes nothing.
- The `noreply@docs.plus` fallback sender.

- `latestSnapshot` from the `history.list` reply. It carried the head version's
  snapshot. The head now loads through `history.watch`, like every other
  version.

### Documentation

- Add **Sign-in mail (Supabase Auth)** to
  [docs/self-hosting/configuration.md](../../docs/self-hosting/configuration.md).
  It lists the dashboard SMTP settings, the minimum interval, the rate limit,
  the OTP expiry and the branded templates. Without custom SMTP, Supabase sends
  about 2 sign-in mails an hour ([#425](https://github.com/docs-plus/docs.plus/issues/425)).

- Record the changes route in [API.md](./API.md), with its window semantics, both
  response shapes, the status table and the section-matching rules. The limits are
  stated rather than omitted. A formatting-only edit reports a null magnitude. A
  caller that rotates every `toc-id` defeats pairing. Request examples live in
  [scripts/documents.http](./scripts/documents.http).
- Record the Favorite route and owner-list `isFavorite` in [API.md](./API.md). The
  required-token list in [docs/api/authentication.md](../../docs/api/authentication.md)
  now includes favorite and unfavorite.
- Record Markdown import media in [API.md](./API.md). A lone media URL, or a
  provider address written as an image, becomes a player node that `PATCH /content`
  accepts. Picture size stays empty on that JSON.
- Record `preview`, `lastOpenedAt`, `lastOpenedAt_desc`, and
  `POST /api/documents/:documentId/opened` in [API.md](./API.md). Owner Trash
  includes `preview`.
- Document the MCP connector for users and for developers, in
  [docs/mcp/README.md](../../docs/mcp/README.md) and
  [docs/mcp/reference.md](../../docs/mcp/reference.md).
  [docs/self-hosting/configuration.md](../../docs/self-hosting/configuration.md)
  says how to turn on the Supabase OAuth server. It also says how to run the
  Supabase script that refuses a connected app's token.
  [docs/api/authentication.md](../../docs/api/authentication.md) says that the
  docs.plus server accepts a connected app's token only at `/api/mcp`. The
  user guide starts with Settings → Connected apps, where a person connects
  and disconnects each app.

### Internal

- One document access rule, `decideDocumentAccess` in
  `src/lib/documentAccess.ts`, serves the REST conversion routes.
- Removed `queue.test.ts` and `worker.test.ts`. They compared constants they
  set themselves and imported no source.

- **The document-changes route now has a real-infrastructure end-to-end script.**
  `bun run test:e2e:document-changes` boots both entry points against Postgres and
  Redis, then drives its assertions over five scenarios. Those are a real edit cycle,
  an empty window, an unstamped baseline, the auth and tombstone gates, and the anchor
  a window actually used. It also pins the two failures no unit test reaches. A
  snapshot that will not decode answers `500`. A `since` before every surviving row
  answers a null baseline rather than an error. A step in `backend-ci.yml` runs the
  script on every backend change.

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

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.2.0
[2.1.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.1.0
[2.0.1]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.1
[2.0.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.0
