<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to docs.plus are documented here.

This file is the product changelog. It names the live webapp. The hocuspocus app keeps [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md). The five `@docs.plus/extension-*` packages keep their own `CHANGELOG.md` files. Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](RELEASE_POLICY.md).

---

## [Unreleased]

## [2.0.0] — 2026-08-21

**First stable product tag after the Etherpad years and the `2.0.0-beta.*` line.** This entry names the live docs.plus pad. The five `@docs.plus/extension-*` packages already shipped `2.0.0` on 2026-08-11. webapp and hocuspocus share `2.0.0`. Admin stays `1.0.0`.

### Highlights

- **Heading Chatroom.** Open chat from a heading or the TOC. See unread on TOC rows and heading chips.
- **TOC.** The TOC shows outline, presence, unread, drag, and fold. Long titles wrap.
- **Document Version History.** List versions, compare two, and restore one. Share `#history?version=` links.
- **Private / Read-only.** Private is owner-only. Turning Private ON clears and disables Read-only.
- **Document conversion.** Import Word or Markdown. Export Word, Markdown, or OpenDocument. Print a PDF from the browser print dialog.
- **Chat media.** Attach up to 10 files. Show a Feed album. Open a Gallery playlist. Media stays inside the column.

### Breaking

- Replace the Etherpad pad with the Next.js pad.
- Treat Private as owner-only. A signed-in stranger is denied. An anonymous visitor must sign in.
- Refuse Access mutation on an Open document. Locks move only when an owner exists.
- Flipping Private or Read-only no longer claims ownership.
- On an owned document, only the owner may change title, description, and keywords.
- Turn Private ON and the control clears and disables Read-only until the document is public again.
- Turn anonymous sign-in off. Local Auth matches production.

### Migration

**If you used Etherpad docs.plus.** Open your documents at [docs.plus](https://docs.plus). The editor is the Next.js pad. Etherpad plugins do not load.

**If you treated Private as any signed-in user.** Private now means only the owner may open the document. Sign in as the owner to change locks. An Open document has no owner, so it cannot turn Private.

**If you claimed an Open document by flipping Private first.** That path is gone. Ownership is set only when a document is created.

**If you self-host.** `make dev-local` is the contributor path. Production needs Postgres, Supabase, S3, email, and DNS. The persist worker is required. See [Self-hosting](docs/self-hosting/README.md) and [hocuspocus CHANGELOG](apps/hocuspocus.server/CHANGELOG.md).

**If you consume the npm extensions.** They already shipped. Read each package `CHANGELOG.md`.

### Added

- Open or create a document from the home page. Type a name, or choose Create New Document.
- Edit a public pad with more than one person at once. Presence shows on the TOC and beside Title.
- Insert pad media from Embed URL or Upload: Picture, Video, Audio, YouTube, Vimeo, SoundCloud, Spotify, Loom, and X.
- Create, preview, and edit hyperlinks on the pad.
- Add Block style for Title, Subtitle, Normal, and Heading 1–6. Title stays locked on the first line.
- Size headings with HeadingScale by section rank. HeadingScale is automatic, not a user font-size control.
- Deep-link headings with Heading slug trail (`?h=` ancestry) and the `id=` resolver.
- Show H1–H6 level chips while dragging a TOC row. Open Focus, Copy link, and Delete Section from the TOC menu.
- Filter sections from Filter with typeahead, chips, Reset, and Match all. Filter terms stay in the URL path.
- Comment from a heading, a selection, or media. Comments open Heading Chatroom.
- Append a Heading 1 at the document end from Add headings.
- Step Block style on mobile with a one-frame control: name, then minus and plus.
- Indent paragraphs and headings with Tab. Outdent with Shift-Tab.
- Convert pasted Markdown into pad blocks. Paste a media URL to embed. Paste an image to upload.
- Record voice into the attachment strip.
- Mention people and `@everyone` from the composer. Insert emoji from the composer panel.
- React to a chat message. Reply, edit, or delete your own messages.
- Copy a message link with `?chatroom=` and `msg_id=`. Copy a message into the document.
- Reply in Thread turns a chat message into a new Heading and opens its chat.
- Reveal spoiler media with two taps before the gallery opens.
- Jump to the latest chat messages. Unread from the server and this session stack on one chip. Show peer read marks on own messages.
- Dock chat on desktop. Mount the mobile Chat pane with Pane mode `closed`, `half`, or `expanded`.
- Drag the Chat pane grabber to snap Pane mode. Close the pane or a sheet with hardware back.
- Add Settings → Documents: search, sort, list or grid, Rename, Duplicate, and Trash restore or purge.
- Add Settings → Profile: avatar, username, name, bio, and social links.
- Open Settings as a full-screen mobile takeover. Confirm Sign out before the session ends.
- Add Bookmarks and Notifications on the pad. Add Settings → Notifications for push and email digest.
- Open a peer profile peek from an avatar or a mention.
- Add `/privacy` and `/terms`, linked from the home footer.
- Add Graphite and Paper themes beside Light, Dark, and High Contrast. System follows the base pair only.
- Link a web app manifest and show an install prompt.
- Show who holds text in a version on the desktop Authors tab. None and Not recorded are common.

### Changed

- Lead sign-in with Continue with Google.
- A new document is public until an owner turns Private.
- On an Open document, anyone may retitle, signed in or not.
- Share Access mutation across Document settings and the Documents ⋮ menu. Confirm Private ON first.
- Hide Copy link once Private is on. Disable Read-only while Private is on.
- Turning Private ON live-seals the room and kicks non-owners.
- Soft-delete to Trash. The reaper purges after the retention window (default 30 days).
- Treat the pad status chip as local. It moves `saving` → `synced` after a 300 ms timer.
- Treat durable persist as the version row. The pad status chip becomes `saved` on worker `document:saved`.
- Debounce durable store at 10 s idle, or 60 s while typing continues.
- Keep a local draft across reload until the worker writes the first version.
- Restore rewrites the shared live document for every connected editor.
- Stage an import and show lossy-conversion warnings before Replace document.
- File exports use the last saved snapshot, not live unsaved keystrokes.
- Print only the document. Hide the pad shell. Browser Print / Save as PDF uses that page.
- Build heading share URLs with Heading slug trail to Title, not every prior heading.
- Size mobile chat as a Chat pane, not a bottom sheet.
- Compact the landing shell from keyboard visibility, not slug-input focus.
- Gate the mobile pad shell on user-agent, not viewport width.

### Fixed

- Clamp Feed album tiles to the measured column so chat media does not overflow.
- Close mobile sheets with the hardware back button instead of leaving the document.
- Seed a new document outside undo history so the first undo cannot empty the pad.
- Apply document filters on mobile without a desktop-only editor host.
- Recover a failed OAuth code exchange, clear the stale code, and prompt a retry.
- Evict a pruned history version and open the newest row instead of looping.

### Removed

- Remove the Etherpad application from the shipped tree.
- Remove anonymous sign-in.
- Remove the signed-in-user Private rule. Signed-in non-owners get PrivateAccess `denied`.
- Drop the mobile chat sheet. Mobile chat is the Chat pane only.

### Documentation

- Add reader docs under `docs/` for self-hosting, the API, and decision records.
- Point API callers at [`docs/api`](docs/api), [`apps/hocuspocus.server/API.md`](apps/hocuspocus.server/API.md), and [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md).
- The OpenAPI page at `/docs` is not on the public edge.
- Document `make dev-local` as the contributor first-run path in `README.md` and `CONTRIBUTING.md`.
- Direct vulnerability reports to `security@docs.plus`. Do not open a public GitHub issue for one.
- Index the five npm extensions in `extensions/README.md`.

---

## Pre-`2.0` history

The product already shipped as `2.0.0-alpha.103` and then `2.0.0-beta.103`. This tag leaves that pre-release line. The last Etherpad-line tag on GitHub is `v1.8.18`.

---

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/docs-plus/docs.plus/compare/v1.8.18...v2.0.0
