<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to docs.plus are documented here.

This file is the product changelog. It names the live webapp. The hocuspocus app keeps [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md). The five `@docs.plus/extension-*` packages keep their own `CHANGELOG.md` files. Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- Favorite owned documents from Settings → Documents. The ⋮ menu lists Favorite or
  Unfavorite after Duplicate, before Private. Favorited documents sit at the top of the
  list and the grid. The chosen sort still orders inside each group. A gold star mark
  shows the state on the row and the tile while the menu is closed. There is no toolbar
  star. Soft-delete keeps the mark, so a restored document stays favorited. Trash does
  not list Favorites.
- Keep playable media and picture size on Markdown replace. Settings → Import &
  export turns a lone video, audio, or embed URL into a player, and writes each
  picture's natural width and height. A labeled link and a filter link stay links.
  Paste of a bare file address is unchanged.
- Paint a first-page paper on Settings → Documents grid, list, and Trash. The
  paper paints stored DocumentGridPreview JSON in React. It is not a screenshot.
  Empty paper shows “Empty document”.
- Sort Settings → Documents by Last opened. Opening an owned pad stamps Last
  opened. Last modified does not move. A document never opened shows
  “Never opened”.
- Group the rest of the list and the grid with date headers: Today, Yesterday,
  Previous 7 days, Previous 30 days, and Earlier. Favorites stay unbucketed at
  the top, then a hairline. Title sorts stay a flat list. Last opened sort also
  uses Never opened when `lastOpenedAt` is null.

### Fixed

- Show formatting edits in version compare. Bolding a word, changing a link's address, or
  moving a heading from one level to another painted no highlight at all, so the reader saw
  an unchanged document while the edit was really there. The diff now compares marks and
  attributes as well as words. A formatting-only edit gets an edge on the block rather than
  a background tint, because the words did not change.
- Stop version compare drawing an empty strikethrough. A formatting edit reports a change
  that holds no text, and the removed-text marker was rendered anyway, telling the reader a
  word had gone when none had.

## [2.0.1] — 2026-08-31

**A measurement release.** No new features and no user-facing change. This entry names
runtime, build and test work, plus two defects found while measuring. The webapp and
hocuspocus share `2.0.1`. Admin stays `1.0.0`.

### Changed

- Raise the Bun floor to `1.4.0` across `engines`, `bun-types`, and every document that
  names it. CI and production already ran `1.4.0`, so this makes the repository say what
  it runs.
- Cut the backend image by scoping its production install to the backend closure. It was
  installing the whole workspace, so it shipped two Next.js versions and four SWC binaries
  that the REST, WebSocket and worker processes never import.
- Stop stamping ownership with a recursive `chown` in the backend image. `COPY --chown`
  writes ownership as each layer is written, instead of storing a second copy of the tree.
- Stop the webapp runtime image inheriting the build toolchain. It carried a C++ compiler,
  `python3` and a second JavaScript runtime it never used.
- Declare per-deploy values below the install in the webapp and admin images, so a changing
  git hash no longer invalidates the dependency install on every build.
- Run the five clean-room extension suites concurrently in the local gate.

### Fixed

- Exit non-zero when a backend process crashes. All three entrypoints routed an uncaught
  exception into a shutdown whose success path exited `0`, so a crash reported success and
  nothing downstream reacted.
- Restore the webapp Cypress duration split. It never loaded its timings file, so the
  four-way split was balancing by file count rather than by recorded duration.
- Await real events instead of fixed sleeps in the worker integration test. The shutdown
  case slept two seconds and then asserted the exit code, so a correct process whose drain
  took longer failed the test.
- Make the `.dockerignore` secret patterns recursive. A root-anchored `*.pem` matched only
  the context root, so a nested key still reached the build context.

### Measured

Verified on the production host in deploy `33367037524`.

|                         | before  | after  |
| ----------------------- | ------- | ------ |
| Production Docker build | 997 s   | 683 s  |
| webapp image            | 727 MB  | 332 MB |
| backend image           | 5.67 GB | 961 MB |
| Backend test suite      | 7.9 s   | 3.1 s  |
| Extension test gate     | 209 s   | 88 s   |
| Full local CI gate      | 290 s   | 163 s  |

The build-cache work lands from the next deploy onward. This one was the first build with
the new layer structure, so only 2 of 165 steps could be cached.

## [2.0.0] — 2026-08-26

**First stable product tag after the Etherpad years and the `2.0.0-beta.*` line.** This entry names the live docs.plus pad. The five `@docs.plus/extension-*` packages already shipped `2.0.0` on 2026-08-11. webapp and hocuspocus share `2.0.0`. Admin stays `1.0.0`.

### Highlights

- **Heading Chatroom.** Open chat from a heading or the TOC. See unread on TOC rows and heading chips.
- **TOC.** The desktop TOC and the mobile TOC both show the outline and fold. Presence and drag are desktop only. Long titles wrap.
- **Document Version History.** List versions, compare two, and restore one. Share `#history?version=` links.
- **Private / Read-only.** Private is owner-only. Turning Private ON clears and disables Read-only.
- **Document conversion.** Import Word or Markdown. Export Word, Markdown, or OpenDocument. Print a PDF from the browser print dialog.
- **Chat media.** Attach up to 10 files. The Feed album tiles pictures and video in the message. Open the Gallery playlist to step through them. Media stays inside the column.

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

**If you claimed an Open document by flipping Private first.** That path is gone. The server records a signed-in creator as the owner. A later lock flip never sets one.

**If you self-host.** `make dev-local` is the contributor path. Production needs Postgres, Supabase, S3, email, and DNS. The persist worker is required. See [Self-hosting](docs/self-hosting/README.md) and [hocuspocus CHANGELOG](apps/hocuspocus.server/CHANGELOG.md).

**If you consume the npm extensions.** They already shipped. Read each package `CHANGELOG.md`.

### Added

- Open or create a document from the home page. Type a name, or choose Create New Document.
- Visit `new.docs.plus` and land in a fresh document straight away. The same jump works at `/new`, which the installed app uses for its New Document shortcut. A one-time tip on a new document names that host.
- Edit a public pad with more than one person at once. On desktop, presence shows on the TOC and beside Title.
- Format pad text with Bold (⌘+B), Italic (⌘+I), Underline (⌘+U), Strikethrough (⌘+⇧+S), and Highlight (⌘+⇧+H). Press Ctrl in place of ⌘ on Windows and Linux. The buttons sit on the desktop toolbar, and in the mobile Text formatting panel while the keyboard is up.
- Add a Bullet List, an Ordered List, or a Task List from the desktop Lists menu. The mobile Text formatting panel offers the same three lists. A blockquote button sits on the desktop toolbar only.
- Add a code block, or mark inline code, from the Code menu on the desktop toolbar. The mobile toolbar has no Code menu, so type instead: three backticks start a block, and backticks around text make a span. ⌘+E, or Ctrl+E, toggles the span. The block highlights syntax for the nine languages it detects, and the pad has no language picker.
- Clear Formatting strips every mark from selected text, hyperlinks and inline code included. With nothing selected it clears block formatting instead and leaves marks in place.
- Add the Block style picker: Normal text, Subtitle, and Heading 1 to Heading 6. Title is not a choice. It is the locked first line, and the picker reads Document title there.
- Step Block style on mobile with a one-frame control: name, then minus and plus.
- Size headings with HeadingScale by section rank. HeadingScale is automatic, not a user font-size control.
- Indent paragraphs and headings with Tab. Outdent with Shift-Tab. Inside a list, Tab nests the item instead.
- An empty top-level paragraph or heading shows a breadcrumb of its parent headings, for example `Install > Docker > Heading 3`. Only the block holding the caret shows one. The first line reads `Enter document name`. A block inside a list or a quote keeps a short label, and an empty code block reads `Write code`.
- The mobile pad opens in read mode. Tap the round pencil button, or double-tap the text, to start typing. Closing the keyboard returns the pad to read mode. The pencil button hides while the Chat pane is open, and neither path unlocks a Read-only document.
- Open the Text formatting panel from the mobile pad toolbar. That toolbar appears only while the on-screen keyboard is open, so tap the pencil button first.
- Convert pasted Markdown into pad blocks. Paste a media URL to embed. Paste an image to upload.
- Copy the whole pad to the clipboard from Copy Document in the desktop toolbar. It writes rich text and plain text. Where the rich write is not available, the fallback copies plain text only.
- Insert pad media from Embed URL or Upload: Picture, Video, Audio, YouTube, Vimeo, SoundCloud, Spotify, Loom, and X.
- The Upload tab takes a file up to 10MB. Sign in first: an anonymous editor gets an `Authentication required` message. A placeholder holds the spot while the file uploads, and Cancel stops it. docs.plus refuses a larger file with a message before any upload starts.
- Set a caption on pad media. Choose Left, Center, Right, Wrap left, or Wrap right. Margin only changes the gap when text wraps.
- The desktop media toolbar hides Margin unless the media wraps, and keeps Replace URL, Copy, and Delete in an overflow menu. Download covers Picture, Video, and Audio only. Mobile opens a layout sheet with no Replace URL.
- Create, preview, and edit hyperlinks on the pad. Open the link box with ⌘+K on macOS, or Ctrl+K elsewhere. In the box, pick a heading from this document. Sign in and the box also lists your Bookmarks, the chat messages you saved in this document. The preview shows the page title with a favicon or preview image, and falls back to the raw URL.
- Click a link that points into the current document, then pick the destination in the link preview. It scrolls to the top or a heading, opens the Heading Chatroom, applies a filter, or opens Document Version History. A link inside a chat message runs on the click itself.
- Deep-link headings with Heading slug trail (`?h=` ancestry) and the `id=` resolver.
- The desktop TOC marks the heading you are reading and scrolls that row into view. The mobile TOC is a drawer, and it opens at that row.
- Open the mobile TOC drawer from the menu button in the pad title bar. Its footer opens Filter and Document settings, plus Bookmarks when you are signed in.
- Drag a desktop TOC row to move its whole section. Drag it sideways to change its heading level. Level chips on the row show the levels you can reach: up to three steps each way, inside H1 to H6.
- Right-click a desktop TOC heading row for Chat Room, Fold Section, Focus Section, Copy link, and Delete Section.
- Focus Section filters the document to that one section. Delete Section removes the heading, its text, and its sub-headings, after a confirm dialog.
- Fold a section from the TOC chevron, shown only on a heading that has sub-headings. The pad collapses the text to paper strips. Click a strip to unfold. Each fold is stored in your own browser, so readers do not share folds.
- Filter sections from Filter with typeahead, chips, Reset, and Match all. Filter terms stay in the URL path.
- Append a Heading 1 at the document end from Add headings.
- Comment from a text selection on desktop only, in a heading or in body text. Comment from media on desktop and mobile. Comments open Heading Chatroom.
- Turn Read-only on and everyone except the owner stops typing on the pad. Document Version History always opens the pad read-only, and hides the heading chat and comment controls.
- Show a gate page when a private document will not open. It asks you to sign in, or it says only the owner may open it. When the server could not check at all, the page offers Try again instead.
- Read Heading Chatroom messages on a public document without signing in. To send or react, sign in and then choose Join Channel. Unread counts also need an account.
- Format a chat message with bold, italic, inline code, a link, lists, a quote, or a code block. Open Text formatting from the composer plus menu.
- Record voice into the attachment strip.
- Mention people and `@everyone` from the composer. Insert emoji from the composer panel.
- Open message actions from the desktop hover menu or a mobile long press. A long press also shows quick reactions, and a reaction needs a signed-in account. Signed-in members of that chat also get a desktop right-click menu.
- React to a chat message. Reply to any message. Edit or delete your own.
- Copy a message link with `?chatroom=` and `msg_id=`. Copy a message into the document.
- Reply in Thread turns a chat message into a new Heading and opens its chat.
- Bookmark a chat message from its hover, right-click, or long-press menu. You must sign in first. Open Bookmarks on the pad to find it again. The panel lists this document only.
- Open Notifications on the pad. It has Unread, Mentions, and Read tabs, and lists this document only. Mark all read clears both unread counts.
- Keep an unsent chat message per channel. The chat draft comes back when you reopen that chat in the same browser.
- Mark an image attachment as a spoiler before you send it. Only the desktop composer shows the toggle, and only for images.
- Reveal spoiler media with two taps before the gallery opens.
- Jump to the latest chat messages. Unread from the server and this session stack on one chip. Show peer read marks on own messages.
- Set a Heading Chatroom to All notifications, Mentions only, or Muted while you are signed in. One toolbar button cycles the three states and shows the current one as an icon. Muted still notifies you about replies and reactions to your own messages.
- Dock chat on desktop. Mount the mobile Chat pane with Pane mode `closed`, `half`, or `expanded`.
- Drag the Chat pane grabber to snap Pane mode. On a phone, the hardware back button closes the Chat pane, a sheet, or a drawer.
- Add Settings → Documents: search, sort, list or grid, Rename, Duplicate, and Trash restore or purge.
- Undo a document delete for six seconds. In Trash, each document counts down the days it has left. Select rows for bulk Restore or Delete forever, or clear everything with Empty trash.
- Add Settings → Profile: avatar, username, name, bio, and social links.
- Add Settings → Security. It shows the account email you signed up with, and email changes are not supported yet. Add, rename, and remove passkeys on the same page. The passkey card hides when the auth service has passkeys turned off.
- Open Settings as a full-screen mobile takeover. Confirm Sign out before the session ends.
- Add Settings → Notifications for push and email. Choose which events reach you: mentions, replies, or reactions. Each set appears only after its channel is on. Email frequency runs from Immediately to a Daily digest, a Weekly digest, or Never.
- Add Quiet Hours to Settings → Notifications, with a start time, an end time, and a timezone. It appears once push notifications are on. On iOS, push needs docs.plus on the Home Screen and iOS 16.4 or later.
- Stop docs.plus email from the link inside the message. `/unsubscribe` needs no sign-in, and a mail client can unsubscribe in one click. docs.plus also pauses your email after a bounce, and names the address that failed.
- Open a peer profile dialog from an avatar or a mention.
- Show the last account used on this browser when you sign in again. The form offers that person's avatar, name, email, and a `Continue as` button. Choose `Not you?` to forget the account. Signing out keeps it.
- Add `/privacy` and `/terms`, linked from the home footer.
- Serve `/sitemap.xml` and `/robots.txt`. Only the home page, `/privacy`, and `/terms` are listed. Every user document stays `noindex`.
- Share a docs.plus link and the preview shows a real card, not the square app icon. The home page also carries `Organization` structured data.
- Add Graphite and Paper themes beside Light, Dark, and High Contrast. System follows the base pair only.
- Cycle Light, Dark, and System from the desktop pad header while signed out. The full theme picker lives in Settings, which needs a sign-in.
- Install docs.plus as an app from the browser prompt. The installed app carries a New Document shortcut.
- Mirror every open document into IndexedDB as you type. Text written just before a reload survives it and re-syncs on reconnect. A document you have not opened in this browser cannot load offline.
- Show a banner on the pad when your sign-in ends while you edit. Sign in from the banner, or from the status chip. The document stays open. The banner says Session expired only when you were signed in before.
- Show a card in place of the document when the server cannot be reached before the document arrives. docs.plus keeps retrying, and the card clears itself once sync returns.
- Show who holds text in a version on the desktop Authors tab. None and Not recorded are common.

### Changed

- Lead sign-in with Continue with Google.
- Share one sign-in form across hosts. A phone opens it in a bottom sheet. A desktop opens it in a centered dialog.
- Run Continue with Google in a popup window, so the page you were on never reloads. A phone, or a blocked popup, falls back to a full-page redirect.
- A new document is public until an owner turns Private.
- On an Open document, anyone may retitle, signed in or not.
- Share Access mutation across Document settings and the Documents ⋮ menu. Confirm Private ON first.
- Hide Copy link once Private is on. Disable Read-only while Private is on.
- Turning Private ON live-seals the room and kicks non-owners.
- Soft-delete to Trash. The reaper purges after the retention window (default 30 days).
- Treat the pad status chip as local. Its icon changes 300 ms after your last edit. In that state the chip shows an icon and a tooltip, never a status word.
- Treat durable persist as the version row. The chip icon changes when the worker publishes `document:saved`. Its tooltip then reads `All changes saved`.
- Show a word on the pad status chip only when sync is not healthy. Connecting shows while the document loads. Offline, Error, Reload, and Sign in show when sync is in trouble. On mobile the chip stays hidden until then.
- Debounce durable store at 10 s idle, or 60 s while typing continues.
- Keep a local draft across reload until the worker writes the first version.
- Restore rewrites the shared live document for every connected editor.
- Thin unnamed autosave versions older than 30 days to one per day. A name you typed is kept. A machine backup is not, so a very old restore stops being undoable.
- Stage an import and show lossy-conversion warnings before Replace document.
- File exports use the last saved snapshot, not live unsaved keystrokes.
- Print only the document. Hide the pad shell. Browser Print / Save as PDF uses that page.
- Build heading share URLs with Heading slug trail to Title, not every prior heading.
- Size the Chat pane from the live pad shell, so its composer stays reachable in every Pane mode.
- The home page makes room only when the on-screen keyboard opens. Tapping the name field alone no longer shrinks it.
- A narrow desktop window keeps the desktop pad. Only a phone or a tablet gets the mobile pad.
- Fade between palettes when you change the theme. The fade is skipped on the mobile shell, on High Contrast, and under reduced motion.

### Fixed

- Clamp Feed album tiles to the measured column so chat media does not overflow.
- Move the pad caret to the tapped spot on iOS Safari, after the browser snaps it to a word boundary. The fix skips a tap on a hyperlink.
- Stop a link edit on a phone from crashing the pad.
- Close the emoji picker together with the chat reaction sheet. The picker used to stay open after the sheet closed.
- Seed a new document outside undo history so the first undo cannot empty the pad.
- Fix Filter on a phone. It used to do nothing.
- Close mobile sheets with the hardware back button instead of leaving the document.
- Recover a failed OAuth code exchange, clear the stale code, and prompt a retry.
- Re-ask the server after a sign-in on the private gate. The first answer was decided before that sign-in.
- Reopen the collaboration socket after a sign-in on an open document. The pad picks up the new scope without a page reload.
- Recover an open tab after a deploy removes the page asset it needs. docs.plus reloads the tab by itself, and stops after two tries in five minutes.
- Evict a thinned history version and open the newest row instead of looping.
- Put the mobile pad on iPad. Safari reports a Macintosh user-agent, so the shell used to stay on desktop.

### Removed

- Remove the Etherpad application from the docs.plus product.
- Remove anonymous sign-in.
- Remove the signed-in-user Private rule. A signed-in non-owner now sees You don’t have access to this document.
- Drop the mobile chat sheet. Mobile chat is the Chat pane only.

### Documentation

- Add reader docs under `docs/` for self-hosting, the API, and decision records.
- Point API callers at [`docs/api`](docs/api), [`apps/hocuspocus.server/API.md`](apps/hocuspocus.server/API.md), and [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md).
- The OpenAPI page at `/docs` is not on the public edge.
- Document `make dev-local` as the contributor first-run path in `README.md` and `CONTRIBUTING.md`.
- Direct vulnerability reports to `security@docs.plus`. Do not open a public GitHub issue for one.
- Serve `/.well-known/security.txt`, so a reporter finds the address without opening the repository.
- Index the five npm extensions in `extensions/README.md`.

---

## Pre-`2.0` history

docs.plus reaches this tag through two code lines. They share no common ancestor.

**The Etherpad line, to 2022-09.** docs.plus `1.x` was an Etherpad fork. Its last tag is `v1.8.18`, dated 2022-09-07. That code is not reachable from `main`.

**A collaboration server, 2022-09 to 2023-03.** The current `main` starts on 2022-09-20 with a Vite client and a Hocuspocus server. Its first Prisma schema already named Postgres and a `Documents` table of snapshot bytes. Supabase arrived in 2023-01 and brought sign-in.

**The Next.js pad, 2023-04 to 2023-08.** A Next.js and Tiptap pad replaced the Vite client. The editor extensions moved into their own packages, starting with the hyperlink extension in 2023-05. The version string reached `2.0.0-beta.103` on 2023-08-03 and did not move again until this tag.

**Chat, 2024.** Messages, threads, reactions, and mentions landed from 2024-01. Chat then bound to headings. That is the Heading Chatroom in this release.

**The build-out, 2025 to 2026.** Document Version History got its own screen in 2025-02. The admin dashboard and web push notifications followed in 2026-01. The server gained its document content, conversion, and version modules in 2026-07.

**What the record does not show.** These years have no per-release history. `v2.0.0-alpha.103` is the only pre-release tag on GitHub, dated 2023-05-12. `2.0.0-beta.103` was a version string, never a tag. A generated changelog written in 2023 was deleted in 2025, and [`RELEASE_POLICY.md`](RELEASE_POLICY.md) forbids restoring it. Read the git log for anything finer.

---

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.0
