<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/supabase_back` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Breaking

- **Three member functions take a `documentId` ([#574](https://github.com/docs-plus/docs.plus/issues/574)).**
  `20261023120000` drops and re-creates `get_document_member_previews`, `get_document_members`
  and `admin_get_document_member_counts`. They now match `workspaces.id` with the documentId
  verbatim. Before, they matched `workspaces.slug`. That column holds the human slug for
  workspaces made before 2026-08-09, so those documents showed no members. An old client gets
  an error until both sides land. See Migration.

### Migration

Push six of this release's seven migrations with the backend and webapp deploy. The deploy order,
the held `20261026120000` and the `check-grants.sql` runs are in the Migration section of this
release in [`apps/hocuspocus.server/CHANGELOG.md`](../../apps/hocuspocus.server/CHANGELOG.md#migration).

Rename the parameters and the result column in every caller of the three functions:

```diff
- get_document_member_previews(p_slugs text[])            -- returns slug, member_count, previews
+ get_document_member_previews(p_document_ids text[])     -- returns document_id, member_count, previews
- get_document_members(p_slug text)
+ get_document_members(p_document_id text)
- admin_get_document_member_counts(p_slugs text[])        -- returns slug, member_count
+ admin_get_document_member_counts(p_document_ids text[]) -- returns document_id, member_count
```

Pass the documentId exactly as stored. Do not pass `lower(documentId)` or the slug.

### Changed

- **A view keeps its duration when the visit closes before the view queue drains
  ([#603](https://github.com/docs-plus/docs.plus/issues/603)).** `20261025150000` replaces
  `update_view_duration` and `process_document_views_queue`. `update_view_duration` now also
  patches the queued message, and the drain copies that duration into the new row. Both stay
  service-role and pg_cron only.
- **The immediate email payload carries the document and the message
  ([#647](https://github.com/docs-plus/docs.plus/issues/647)).** `20261031120000` replaces
  `process_email_queue`. The payload gains `workspace_id` and `message_id`. `workspace_id` is the
  documentId from `channels.workspace_id`, in exact case. Every old key stays, `document_slug`
  included.
- **Each digest notification carries its own queue row
  ([#647](https://github.com/docs-plus/docs.plus/issues/647)).** `20261031130000` replaces
  `compile_digest_emails`. Each notification object gains `queue_id`, its own `email_queue` row
  id. Every old key stays, so an old server ignores the new one.

### Security

- **An erased account can no longer write back its profile, preferences or push devices
  ([#579](https://github.com/docs-plus/docs.plus/issues/579)).** An erased account keeps a live
  access token for up to an hour. `20261024120000` adds checks that refuse those writes. Grants
  and security modes stay the same.
- **New pgmq and storage objects start closed to anon and authenticated
  ([#570](https://github.com/docs-plus/docs.plus/issues/570)).** `20261026120000` changes the
  default privileges in `pgmq` and `storage`. Existing grants do not change. This migration is
  held; see Migration.

### Removed

- **`get_bookmark_count` and `admin_get_user_notification_subs`
  ([#605](https://github.com/docs-plus/docs.plus/issues/605)).** Nothing called them.
  `20261025120000` drops both, with no `CASCADE`.

### Internal

- **pgTAP policy tests ([#583](https://github.com/docs-plus/docs.plus/issues/583)).**
  `packages/supabase/tests/` covers chat messages, chat media storage, the document views queue
  and writes after an erase. Run them with `bun run --filter @docs.plus/supabase_back test`.
  CI runs them in `.github/workflows/supabase-policies.yml`.
- **The checks cover two more rules.** `check-functions-parity.ts` fails when the four Private
  `document_access` clauses in `10-0-func-helpers.sql` differ. `check-grants.sql` and
  `check-grant-allowlists.ts` flag a SELECT grant to `authenticated` on `users.email` or
  `users.notification_preferences`.

## [2.2.0] — 2026-10-22

### Highlights

- **Supabase grants are closed in one pass.** Helper functions, self-gated RPCs, trigger
  functions, anon tables and new partitions lose their open grants
  ([#469](https://github.com/docs-plus/docs.plus/issues/469),
  [#318](https://github.com/docs-plus/docs.plus/issues/318),
  [#470](https://github.com/docs-plus/docs.plus/issues/470),
  [#315](https://github.com/docs-plus/docs.plus/issues/315)).
- **New tables, sequences and functions start closed
  ([#316](https://github.com/docs-plus/docs.plus/issues/316)).**
- **The bell and push read one online rule, and email follows the bell.** A member is online only when `status` is
  `ONLINE` and `online_at` is under 2 minutes old
  ([#489](https://github.com/docs-plus/docs.plus/issues/489),
  [#490](https://github.com/docs-plus/docs.plus/issues/490)).
- **Unused objects are dropped.** `create_direct_message_channel`, the `pg_net` extension and five
  objects that only production had are gone
  ([#319](https://github.com/docs-plus/docs.plus/issues/319),
  [#320](https://github.com/docs-plus/docs.plus/issues/320),
  [#321](https://github.com/docs-plus/docs.plus/issues/321)).

### Breaking

- **New objects start closed ([#316](https://github.com/docs-plus/docs.plus/issues/316)).** A
  custom migration must grant its own objects in the same file. See Security and Migration.
- **Open grants are revoked ([#469](https://github.com/docs-plus/docs.plus/issues/469), [#470](https://github.com/docs-plus/docs.plus/issues/470), [#318](https://github.com/docs-plus/docs.plus/issues/318)).**
  A caller that uses the anon key or PostgREST directly may lose access to an `internal` helper,
  a table or an RPC. See Security.
- **Five functions, a table and an extension are dropped ([#319](https://github.com/docs-plus/docs.plus/issues/319), [#320](https://github.com/docs-plus/docs.plus/issues/320), [#321](https://github.com/docs-plus/docs.plus/issues/321)).**
  See Removed.

### Migration

Apply the 14 migrations of this release in timestamp order, before the new server starts. No
migration is held. The full steps, with the `check-grants.sql` runs, are in the 2.2.0 Migration
section of [`apps/hocuspocus.server/CHANGELOG.md`](../../apps/hocuspocus.server/CHANGELOG.md).

A migration you write for your own objects must now grant them in the same file. Before, a new
`public` object was open to `anon` by default. After:

```sql
create function public.my_reader() returns integer language sql as $$ select 1 $$;
grant execute on function public.my_reader() to authenticated;
```

### Changed

- **Presence heartbeats are HOT updates ([#491](https://github.com/docs-plus/docs.plus/issues/491)).**
  `20261019140000` makes `idx_users_online_status` key only `id`, so no index on `public.users`
  names `online_at`. It drops the duplicate `idx_users_username`. `users_username_key` serves the
  same lookups.

### Fixed

- **A person who left is no longer stuck `ONLINE` ([#489](https://github.com/docs-plus/docs.plus/issues/489)).**
  `20261014120000` makes `update_user_online_at` stamp `online_at` only on an `ONLINE` write. A
  one-time data fix sets `ONLINE` rows with a NULL `online_at` to `OFFLINE`. This narrows the 2.1.0 change from `20261006120000`.
- **The chat bell uses the online lease, as push does ([#490](https://github.com/docs-plus/docs.plus/issues/490)).**
  `20261014120100` makes the plain-message bell call `internal.is_user_online`. Before, it read
  the raw `users.status` flag.
- **A queued email is skipped when the member already read the message in the channel ([#497](https://github.com/docs-plus/docs.plus/issues/497)).**
  `20261014120300` skips it when `channel_members.last_read_seq` has passed the message `seq`.
  Bell rows stay as they are. A row with no `message_id`, such as `content_change`, sends as
  before.
- **An erased account no longer gets bell rows ([f21eb3810](https://github.com/docs-plus/docs.plus/commit/f21eb3810)).**
  `20261019120000` makes `skip_unopenable_notification` drop a row when the receiver has
  `users.deleted_at` set. The trigger loses its `channel_id` WHEN clause, so a channel-less
  `system_alert` is gated too.
- **Chat message counts no longer freeze after a channel is deleted ([7f0840b3e](https://github.com/docs-plus/docs.plus/commit/7f0840b3e)).**
  One queued event for a deleted channel broke the `channel_id` foreign key, and that error
  rolled back every cron run. `20261019130000` makes the counter worker read the live channel
  row. It drops events whose channel is gone.

### Security

- **`internal` helpers are closed ([#469](https://github.com/docs-plus/docs.plus/issues/469)).**
  `20261014121000` resets EXECUTE on every `internal` function. It then grants back what
  policies, the invoker body `normalize_chat_media_path` and the server paths call.
- **Self-gated RPCs and trigger functions are closed ([#318](https://github.com/docs-plus/docs.plus/issues/318)).**
  `20261014121100` changes grants only. It covers the self-gated RPCs and the definer trigger
  functions in `public`.
- **Anon loses its default table rights ([#470](https://github.com/docs-plus/docs.plus/issues/470)).**
  Production never ran section 3 of `29-lint-hardening.sql`. `20261014121200` revokes every anon
  table right, then grants back the guest chat read path. The `users` list leaves out `email`,
  `status` and `online_at`.
- **New `document_views` partitions close themselves ([#315](https://github.com/docs-plus/docs.plus/issues/315)).**
  `20261014121300` makes each new partition enable RLS and revoke the browser roles. It also
  closes the partitions made since `20261008140000`. A partition that is still open aborts the
  migration.
- **New objects start closed ([#316](https://github.com/docs-plus/docs.plus/issues/316)).**
  `20261021120000` changes the default privileges of role `postgres`. `anon` gets nothing new in
  `public`, and no new function gets `PUBLIC` execute in any schema. Existing objects do not
  change.

### Removed

- **`create_direct_message_channel` ([#319](https://github.com/docs-plus/docs.plus/issues/319)).**
  No code in the repo called it, and its access check let any user add any user to a DM.
  `20261014121400` drops every overload, with no `CASCADE`.
- **The `pg_net` extension ([#321](https://github.com/docs-plus/docs.plus/issues/321)).** Push and
  email moved to pgmq, and the repo no longer calls `net.*`. `20261014121500` refuses the drop
  when a caller exists.
- **Five objects that only production had ([#320](https://github.com/docs-plus/docs.plus/issues/320)).**
  `20261021120100` drops four `public` functions (`cleanup_push_subscriptions`,
  `get_push_notification_stats`, `get_push_subscriptions`, `reset_workspace_unread_counts`) and
  the empty `PushSentLog` table. `internal.cleanup_push_subscriptions()` stays, because the push
  cleanup cron job runs it.

### Internal

- **`scripts/check-grants.sql` is the grant check after each push ([#317](https://github.com/docs-plus/docs.plus/issues/317)).**
  Run it read-only against the database. Zero rows means pass. It also flags a default that would
  give `PUBLIC` execute on a new function in any schema.
- **Two checks keep `scripts/` and `migrations/` in step.** `bun run --filter @docs.plus/supabase_back check`
  runs `check-functions-parity.ts` and then `check-grant-allowlists.ts`. The first fails when a
  function in both trees has different definitions. The second keeps the copies of each grant
  allowlist equal. CI runs both.

## [2.1.0] — 2026-10-13

### Highlights

- **Content-change followers live in the database ([#203](https://github.com/docs-plus/docs.plus/issues/203)).**
  A new `notification_category` value, `content_change`, tells followers that a document changed.
- **Private document chat is owner-only ([#396](https://github.com/docs-plus/docs.plus/issues/396)).**
  `public.document_access` copies the Private flag and the owner from the server.
- **A heading chat is keyed by its document ([#402](https://github.com/docs-plus/docs.plus/issues/402)).**
  Channels gain `heading_id`, keyed per workspace.
- **Private settings leave the public profile.** Notification preferences move to
  `users.notification_preferences`, and status and last-active time are hidden
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)).
- **Supabase refuses a connected app's token outside the MCP server.** An optional hook also
  refuses every password sign-in.

### Breaking

- **No client reads `users.status` or `users.online_at` ([#434](https://github.com/docs-plus/docs.plus/issues/434)).**
  `20261009120500` revokes SELECT on both columns from `anon` and `authenticated`. A client read
  fails with `42501`, and that includes an `update ... returning` that names one. It also takes
  `public.users` out of `supabase_realtime`, so a `postgres_changes` subscription on it gets no
  events.
- **A client inserts a channel only through five columns ([#402](https://github.com/docs-plus/docs.plus/issues/402)).**
  `20261009130100` grants INSERT on `workspace_id`, `heading_id`, `created_by`, `name` and `slug`.
  An insert that names `id` gets `42501`.
- **Notification preferences leave `users.profile_data`.** `20260930120000` moves them to the
  new column `users.notification_preferences`, which has no client SELECT grant. The check
  `profile_data_has_no_notification_preferences` refuses the old key with `23514`.

### Migration

Apply 26 migrations in timestamp order before the new server starts. Hold `20261009120500` and
`20261009130100`. The 2.1.0 Migration section of
[`apps/hocuspocus.server/CHANGELOG.md`](../../apps/hocuspocus.server/CHANGELOG.md) says when to
apply them and what to check.

Read notification preferences through the owner's RPC. Write them through
`update_notification_preferences`, never inside `profile_data`:

```diff
- supabase.from('users').select('profile_data')  // notification_preferences inside
+ supabase.rpc('get_notification_preferences')
```

### Added

- **Content-change followers ([#203](https://github.com/docs-plus/docs.plus/issues/203)).**
  `20260904100000` adds the `content_change` value to `notification_category`. Postgres forbids
  using an enum value in the transaction that adds it, so `20260904100100` ships the rest. It adds
  `workspace_members.content_email_muted_at`, where `NULL` means following. It adds the
  service-role fan-out `notify_document_content_change`. It adds the browser pair
  `set_document_follow` and `get_document_follow_state`, both gated on `auth.uid()`. Push and
  email gate the new type; push defaults off and email defaults on. The partial index
  `idx_notifications_content_change_open` serves the 24-hour dedupe.
- **Last left.** `20260907153621` adds `workspace_members.last_connection_closed_at` and its one
  writer, `mark_document_connection_closed`. Only the service role may call it. The column only
  moves forward.
- **Pad title change notice.** `20260908093000` adds `notify_document_title_change`, which only
  the service role may call. It recreates three inbox fan-out trigger WHEN clauses, so a row with
  `type = notification` never mails or writes `public.notifications`.
- **Admin revoke in one call ([#412](https://github.com/docs-plus/docs.plus/issues/412)).**
  `20261009120400` adds `admin_revoke_admin`. It counts and deletes under one table lock, so two
  admins who revoke each other cannot leave zero admins. It is service-role only.

### Changed

- **A `content_change` always takes the digest branch ([#204](https://github.com/docs-plus/docs.plus/issues/204)).**
  `20260904160000` pins it. The immediate path has no send-time privacy check, so it could mail a
  line about a document that is now Private.
- **One `@` token rule for chat notifications.** `20260921120000` replaces
  `create_mention_notifications`, `create_everyone_notifications` and
  `create_regular_message_notifications`. A token is `@` plus the longest run of `[A-Za-z0-9_-]`,
  and it names a user only on an exact match. The sender is never mentioned.
- **The bell counts account-wide alerts in every workspace.** `20261001120000` changes
  `notifications_summary` and `get_unread_notif_count`. A notification with no `channel_id`, such
  as the bounce `system_alert`, now counts in every workspace.
- **`online_at` follows the status heartbeat ([#417](https://github.com/docs-plus/docs.plus/issues/417)).**
  `20261006120000` makes `update_user_online_at` stamp it on every status write. The same
  migration makes `update_notification_preferences` refuse a value that the push and email
  triggers cannot cast. It answers `22023` `invalid_preference_value` and names the key.
- **Unsubscribe links are signed in the server.** A hosted project cannot set
  `app.unsubscribe_secret`. `20260908132041` drops the SQL signer and keeps `apply_unsubscribe`,
  the write.
- **`push_subscriptions` leaves `supabase_realtime`.** No client subscribes to it.
  `20260930120100` drops it from the publication.

### Fixed

- **The View button on a `content_change` notification opens its page ([#205](https://github.com/docs-plus/docs.plus/issues/205)).**
  `20260904180000` makes `notifications_summary` return `action_url`.
- **Settings links open Settings.** The webapp has no `/settings` route, so those links opened a
  pad named "settings". `20260907175946` points the email footer preferences link at
  `/#settings?tab=notifications`. `20260922120000` points the bounce `system_alert` from
  `record_email_bounce` at the same hash.

### Security

- **Supabase refuses a connected app's token.** `20260928120000` adds the PostgREST pre-request
  hook `public.refuse_connected_app_request()`. It answers `403` with the code `connected_app`
  for any token that carries a `client_id` claim. Restrictive policies cover `storage.objects`,
  `realtime.messages` and each public table in `supabase_realtime`.
- **Supabase can refuse every password sign-in.** `20260928130000` adds
  `public.hook_block_password_tokens`. As the Custom Access Token hook, it refuses a token for a
  password sign-in with "Invalid login credentials". The operator turns the hook on.
- **Grant and client-write gaps are closed ([#397](https://github.com/docs-plus/docs.plus/issues/397), [#401](https://github.com/docs-plus/docs.plus/issues/401), [#409](https://github.com/docs-plus/docs.plus/issues/409), [#410](https://github.com/docs-plus/docs.plus/issues/410)).**
  `20261006130000` revokes service-role functions from `public`, `anon` and `authenticated`. It
  creates the three `28-ghost-accounts-audit.sql` functions in a migration. Clients no longer
  update `channels` or write `workspaces`. `set_replied_message_preview` refuses a parent from
  another channel. `get_user_bookmarks` returns only messages the caller can read.
- **Clients write only their own message columns ([#400](https://github.com/docs-plus/docs.plus/issues/400)).**
  `20261008120000` grants INSERT and UPDATE on named columns only. Notice rows
  (`type = 'notification'`) come only from server writers. SELECT stays table-wide.
- **A Private document's chat opens only for its owner ([#396](https://github.com/docs-plus/docs.plus/issues/396)).**
  `20261008130000` adds `public.document_access` and `internal.can_open_document`. A missing row
  means public. Chat reads, sends, edits, media, read receipts, `join_workspace`, notifications
  and unread counts check it. The `BEFORE INSERT` trigger `skip_unopenable_notification` drops a
  notification whose receiver cannot open the document. `purge_document_footprint` deletes the
  row.
- **The production grant fix of 2026-09-28 is in a migration ([#314](https://github.com/docs-plus/docs.plus/issues/314)).**
  `20261008140000` ports that hand fix for grants and partition RLS. It is a no-op on production,
  except for partitions made after 2026-09-28.
- **Heading chats are keyed by `(workspace_id, heading_id)` ([#402](https://github.com/docs-plus/docs.plus/issues/402)).**
  `20261009115900` adds `channels.heading_id` and the two per-workspace keys. The `BEFORE INSERT`
  trigger `fill_channel_heading_id` sets `heading_id = id` when an insert leaves it out. Every
  existing row keeps its id.
- **A soft delete clears the text and files of a message ([#435](https://github.com/docs-plus/docs.plus/issues/435)).**
  `20261009120000` adds the trigger `clear_deleted_message_text`. It clears `content`, `html`,
  `medias` and the comment quote. A one-shot backfill clears messages that were already deleted.
- **Anon and non-members read only chat media that a live message names ([#432](https://github.com/docs-plus/docs.plus/issues/432)).**
  Before `20261009120100`, the anon key could list unsent uploads. Channel members keep read on
  every object in the channel.
- **The avatar buckets refuse SVG ([#431](https://github.com/docs-plus/docs.plus/issues/431)).**
  A public bucket serves SVG inline, and an SVG can carry script. `20261009120200` changes the
  allowlist of `user_avatars` and `channel_avatars`. It is forward-only, so an SVG uploaded before
  it still serves.
- **A picked mention notifies the user it was picked for ([#415](https://github.com/docs-plus/docs.plus/issues/415)).**
  `20261009120300` reads the user id from the mention node, so a username change keeps it. A
  typed `@name` still notifies the current holder of that name.

### Internal

- **Local Supabase config.** `config.toml` sets `secure_password_change = true` and exposes
  `smtp_port = 54325` for local mail. It turns on the local OAuth server with dynamic client
  registration. It turns `[auth.passkey]` off and removes `[auth.webauthn]`. The password sign-in
  hook is listed there, commented out.
- **`db reset` no longer fails on `pg_net`.** The seed runs with an empty `search_path`, so
  `00-bootstrap.sql` now creates `pg_net` `with schema extensions`. Before, the reset failed
  with `3F000`.

## [2.0.0] — 2026-08-26

This entry sums up, by area, the 68 migrations in `migrations/` at the `v2.0.0` tag.

### Highlights

- **Chat reads by sequence.** `messages.seq` and `channel_members.last_read_seq` drive the chat
  window, the unread counts and the "seen" mark.
- **Chat can carry media.** Files live in the private `media` bucket, with path-based RLS and a
  cleanup on soft delete.
- **The remote database follows `scripts/`.** Catch-up and parity migrations bring remote
  policies, grants and functions in line with `scripts/`.

### Added

- **Chat window and read cursor.** `20260513140000` adds `messages.seq`, `messages.client_id`
  and `channel_members.last_read_seq`. `20260513140500`, `20260513141000` and `20260513141500`
  add `fetch_message_window`, `fetch_messages_since`, `advance_read_cursor`, `add_reaction` and
  `remove_reaction`. `20260501094525` lets `create_thread_message` take a client id.
  `20260504212243` and `20260513142000` add cursors to `get_channel_aggregate_data`.
  `20260519053356` adds the peer read mark: `peer_max_read_seq` and a `read:advanced` broadcast.
  `20260514170000` broadcasts a soft delete, because anon readers never saw it through
  `postgres_changes`. `20260617120000` adds the document comment message type.
- **Chat media.** `20260623120000` adds the private `media` bucket and its path-based policies. It
  also adds `validate_message_medias` (at most 10 files) and the storage cleanup on soft delete.
- **Documents.** `20260708084510` adds the member roster, `get_document_member_previews` and
  `get_document_members`. `20260708144905` adds `purge_document_footprint`, which erases a
  soft-deleted document's footprint after the retention window.
- **Admin.** `20260213161841`, `20260213163344` and `20260213170000` add admin RPCs for push
  subscriptions, push activity and stats, and document member counts. `20260213163344` also makes
  `ack_push_message` archive a message rather than delete it.
- **Monitoring and cron.** `20260702110000` adds `get_pgmq_queue_metrics`, `get_cron_job_health`,
  `get_signups_per_day` and the `cleanup-cron-job-run-details` job. `20260512094329` schedules
  `internal.cleanup_push_subscriptions()`.

### Changed

- **Chat window fixes.** `20260513150000` returns author details with each message.
  `20260513160000` builds them inline, so anon and signed-in readers no longer get a `403`. `20260513150500` keeps reactions as an object.
  `20260513215200` makes `advance_read_cursor` lower the unread count. `20260514180000` returns a
  null anchor when nothing is unread. `20260514190000` adds the bookmark join to the window RPCs.
  `20260519120000` is a one-shot move of every active read cursor to its channel tail.
- **Unread counts.** `20260123185530` lowers the count before a deleted message's notifications
  go. `20260723091318` seeds a new member at 0, not 1. `20260723091319` runs the soft-delete
  cleanup only when `deleted_at` goes from null to set. `20260723091320` leaves the reader's own
  messages out of the count.
- **Notifications.** `20260512094333` matches `@everyone` and `@username` as whole tokens, and
  stops a duplicate `reply` row. `20260515150000` fixes the push preference keys and the quiet
  hours timezone. `20260515160000` adds `update_notification_preferences` and an UPDATE column
  list on `public.users`.
- **Bookmarks.** `20260625143000` leaves archived rows out of the In progress count.
  `20260625150000` gives each bookmark tab its own list query.
- **Admin and analytics.** `20260609092031` leaves soft-deleted users out of the retention stats.
  It locks the four document views read RPCs to the service role.
- **Indexes.** `20260512094330` and `20260512094331` tidy the `messages` indexes and add foreign
  key indexes for the message triggers.
- **Cron.** `20260717015500` makes `get_cron_job_health` one pass and drops a duplicate cleanup
  job. `20260729093000` keeps each job's newest successful run past the 7-day prune.
  `20260806100000` reschedules jobs so `cron.schedule()` keeps each job id.
- **Parity.** `20260519200000` is generated from `scripts/` by
  `generate-functions-parity-migration.ts`. It brings remote functions, triggers and RPCs in line.

### Fixed

- **Notification creators stay `SECURITY DEFINER`.** `20260623120000` recreated them without it,
  so mention and reply sends failed with `42501`. `20260625120000` and `20260702130000` restore it.
- **Public chat media signs again.** In `20260703200000`, the SELECT policies match the object
  path with `objects.name`. Unqualified `name` bound to the channel name.
- **Purged documents leave no views.** `20260715082400` makes `purge_document_footprint` match
  `lower(documentId)`, the key that `document_views` uses.
- **Anonymous views are recorded.** `20260726181000` points `document_views.user_id` at
  `auth.users`, so a logged-out view no longer fails the foreign key.
- **A converted anonymous user gets a profile.** `20260726161802` adds the
  `on_auth_user_converted` trigger and an `ON CONFLICT` arm in `handle_new_user()`.

### Security

- **Chat RLS.** `20260513130000` brings remote chat policies and their `internal` helpers in line
  with `13-RLS.sql`. `20260513130500` stops self-join to DIRECT, GROUP and BROADCAST channels.
  `20260723091317` shows the full `channel_members` roster to channel members only.
  `20260803120000` limits the unread auto-enrol to PUBLIC channels.
- **Grants.** `20260512094332` hides `users.email` from `authenticated` and makes `is_admin` a
  self-check. `20260512094335` makes `create_direct_message_channel` `SECURITY DEFINER`.
  `20260519061500` and `20260610124557` re-grant the browser-facing chat and admin push RPCs.
  `20260610135024` revokes the view tracking RPCs from browser roles. `20260716130500` grants
  table privileges on chat tables to `authenticated` and `service_role`.
- **Document views partitions.** `20260513134919` revokes direct `authenticated` writes on every
  existing partition, not on a fixed list.
- **Storage.** `20260513131000` limits avatar bucket writes to the owner. `20260515120000` keys the
  bucket policies on `owner_id`, and `20260515130000` moves them to path-based checks.
  `20260515140000` restores the SELECT policies, which an upload needs for its readback.
  `20260515170000` scopes them to the caller's own files.
- **Lint.** `20260717015600` wraps bare `auth.uid()` calls in policies and drops duplicate
  indexes.

### Removed

- **v1 chat RPCs.** `20260514114900` drops `mark_messages_as_read`, and `20260514125100` drops
  `get_channel_messages_paginated`.
- **Message forwarding.** `20260520120000` drops its trigger, function and column.
- **The PRIVATE channel type.** `20260726180000` recreates the `channel_type` enum without it,
  and rebuilds the nine policies that depend on it.

---

## Pre-`2.0` history

The path `packages/supabase` first held a git submodule, added on 2023-01-11 and removed on
2023-01-23. The package came back on 2024-05-08 as `supabase_back`, with `config.toml`, numbered
SQL files in `scripts/` and an edge function. The schema then lived only in `scripts/`, which
`db reset` seeds. The first files in `migrations/` landed on 2026-01-28. One of them,
`20260128120000_push_gateway_to_backend.sql`, was deleted on 2026-02-03 and is not in the tree.
