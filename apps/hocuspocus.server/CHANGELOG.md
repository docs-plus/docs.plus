<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/hocuspocus` are documented here.

This file is the operator and API changelog. The pad product lives in the [root CHANGELOG](../../CHANGELOG.md). The pad UI lives in [`apps/webapp/CHANGELOG.md`](../webapp/CHANGELOG.md). Route contracts live in [API.md](./API.md) and [docs/api](../../docs/api). Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

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

### Migration

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
```

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
  inserts, replaces or removes whole blocks at one numbered position, and
  refuses to remove a block that holds a picture, video, embed, upload or file
  link. A new heading goes only at the end of the section. It must be deeper
  than the section heading and no shallower than the next heading, so it never
  takes over the subsections after it.
  `replace_text` changes one exact piece of text inside one paragraph,
  never the name of an attached file,
  list item or table cell, and keeps its formatting. Neither touches the
  heading, and both refuse a stale `rev`. `replace_text` returns the new `rev`;
  `edit_blocks` does not, because it renumbers blocks, so the agent reads again. The internal
  hop modes are now `replace`, `append`, `blocks` and `text`; the old
  `section` mode is gone, so an older replica refuses a new edit during a
  rolling deploy instead of replacing a whole section. ChatGPT keeps the tool
  list it saw when it connected: press **Refresh** on the docs.plus app.

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
  save fans out on every commit, and the worker decides the audience because
  Supabase cannot: `isPrivate`, `ownerId` and `deletedAt` live in Prisma, and
  workspace membership admits any signed-in visitor. A trashed document reaches
  nobody. A private document with no owner reaches nobody. The rule is checked
  again at send time, because a document can turn private after the carrier row
  is written. A `content_change` always takes the digest branch, never the
  immediate one, which has no privacy re-check. A digest left with nothing to
  say marks its `email_queue` rows `'skipped'` rather than mailing an empty
  page. The daily email cap now counts immediate rows only: one digest marks one
  row per notification, so counting every row read a 60-notification digest as
  60 emails. That loosens the cap for existing daily and weekly readers, on
  purpose.
- **Content-change followers, in the database.** A new `notification_category`
  value, `content_change`, carries "this document changed" on
  `public.notifications`. The subscription is workspace membership itself, so
  there is no new table: `workspace_members.content_email_muted_at` holds the
  whole state and `NULL` means following, while `left_at` is also `NULL`.
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
  returns `isFavorite` and orders that user's Favorites first, then `sort`. Trash and the
  public fleet omit both.
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

- **`GET /api/documents` takes `scope=all|owned|joined`.** Settings ›
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

### Changed

- **Admin routes are ready for an `sb_` secret key.** `supabaseRest` sent
  the service-role key both as `apikey` and as a Bearer token. An `sb_` key
  is not a JWT, and Supabase says to send it on `apikey`, not as a Bearer
  token. An `sb_` key now goes on `apikey` only. A legacy JWT key still
  sends both headers.
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
  `runs` list never holds only `same` and `gap` runs. An edit of whitespace,
  U+00A0, a zero-width space, non-joiner or joiner, a word joiner, a bidi mark
  (LRM, RLM or ALM) or U+FE0F alone gives no `runs`. The excerpts are cleared
  with it. An excerpt with no visible
  text is left out. An added or removed image, video or embed reads `image`,
  `video` or `embed` in `runs` and in a whole section's excerpt. A new
  optional `previousLevel` holds the baseline level of a `modified` heading
  whose level changed. Word counts do not change. A section measure that
  throws now logs at warn.
- **Admin notification stats read `users.notification_preferences`.** Push the
  Supabase migration `20260930120000_private_notification_preferences` before
  you deploy this server.
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
- **Owner Trash list includes `preview` and `lastOpenedAt` and fills SQL-NULL
  rows.** The older Owner live list Added bullet said Trash omits both.
  Fill matches the Owner live list. Owner Trash list still omits Favorite.
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

- **The Owner live list pins only your own Favorites.** `GET /documents`
  with your own `ownerId` ordered by the count of every user's Favorite
  rows. A pad starred only by someone else pinned with no star, and Command
  jump, Home and Settings 'Owned by me' showed it out of order. The list now
  pins with the same rule as the Merged list.

- **A content write to a cold document waits for its own commit (#229).**
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
  active person looked offline after 2 minutes. Push the Supabase migration
  `20261006120000_push_online_at_and_preference_checks`
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **`update_notification_preferences` refuses a value the push and email
  triggers cannot cast.** It answers `22023` `invalid_preference_value` and
  names the key. A bad value used to abort message inserts. The same
  migration carries it
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).

### Security

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

- **Supabase refuses a connected app's token.** Run
  `packages/supabase/scripts/31-connected-app-token-gate.sql` once, or push
  the paired migration `20260928120000_refuse_connected_app_tokens`. The Data
  API answers `403` with the code `connected_app`. Storage and Realtime refuse
  the token too. The MCP tools use the service-role key, so they still work.
  Check the existing `pgrst.db_pre_request` first, as
  [configuration](../../docs/self-hosting/configuration.md#turn-on-the-mcp-connector)
  says.

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
  Deploy order: confirm that `20261006130000_close_client_write_and_grant_gaps` is applied,
  because the bookmark panel gate lives there. Then apply this migration,
  deploy this server, and run `scripts/backfill-document-access.ts` (a dry run
  first, then `--apply`). Until the backfill runs, Private documents' chat
  stays open ([#396](https://github.com/docs-plus/docs.plus/issues/396)).
- **A picked chat mention notifies the user it was picked for.** A username
  change no longer sends it to the next holder of that name. A typed `@name`
  still notifies the current holder of that name. The Supabase migration
  `20261009120300_resolve_mentions_by_user_id` carries the fix; push it by hand
  ([#415](https://github.com/docs-plus/docs.plus/issues/415)).
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
  A token already past `exp` is refused like an invalid one. Each signed-in tab
  reconnects about once per token lifetime, which is 1 hour by default
  ([#430](https://github.com/docs-plus/docs.plus/issues/430)).

### Removed

- The SendGrid provider. `SENDGRID_API_KEY` stays in the schema only so that
  a leftover key reads `invalid`.
- `SMTP_FROM_NAME`. Nothing ever read it, so its removal changes nothing.
- The `noreply@docs.plus` fallback sender.

- `latestSnapshot` from the `history.list` reply. It carried the head version's
  snapshot. The head now loads through `history.watch`, like every other
  version.

### Documentation

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
  user guide starts with Settings > Connected apps, where a person connects
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

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.0
