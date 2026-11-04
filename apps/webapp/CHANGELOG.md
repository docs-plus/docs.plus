<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/webapp` are documented here.

This file is the pad UI changelog. Write pad UI notes here. Write the
product announcement in the [root CHANGELOG](../../CHANGELOG.md). Do not
copy a bullet into both. The backend lives in
[`apps/hocuspocus.server/CHANGELOG.md`](../hocuspocus.server/CHANGELOG.md).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- The pad page head names a share image
  ([#663](https://github.com/docs-plus/docs.plus/issues/663)). A full page load asks REST for
  the pad's card with `card=1`. `og:image`, `twitter:image` and their alt text then point at that
  card. A pad with no card gets the static `icons/og-card-pad-1200x630.png`. A description that
  equals the Pad title or the slug is replaced by the product description. The card query
  carries only the keys of the place the link opens.
- A History share link now also carries `?version=<n>` in the address, so a server can draw
  that version's card ([#668](https://github.com/docs-plus/docs.plus/issues/668)). The pad
  takes the query off on arrival and opens History at that version, on a fresh load and on an
  in-app jump.
- Every pad link now shows a link icon before its text, in the pad, history and `/editor`
  ([#516](https://github.com/docs-plus/docs.plus/issues/516)). A link to another pad shows the
  docs.plus logo, and `mailto:` and `tel:` links show a mail or phone glyph. Other web links show the site's
  favicon from our own icon route. A link with no icon stays a plain link. Print and the chat
  composer show no link icons. This goes against Google Docs, Word and Notion on purpose
  (maintainer ruling, 2026-10-17).
- The Home Screen app links launch images for 440x956, 402x874, 420x912, 428x926 and 375x812
  at 3x, next to the three sizes it had. Every other iPhone, the iPhone 17 line among them,
  used to open on a black screen ([#255](https://github.com/docs-plus/docs.plus/issues/255)).
- On a desktop pad, resting the pointer on a link opens the hovercard
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)). The request starts after 150 ms,
  and the card opens at 500 ms at the earliest. It shows the page's picture, title, up to three
  facts and description, and all of it comes through our server. A job page shows its place, work
  type and posting date. A GitHub repository shows stars, language and last push. A Stack Overflow
  question shows its answers. A press or most keys close the card. Its title opens an external
  page in a new tab, and another pad in the same window. Mod-click and middle-click on the title
  open a new tab. The phone, chat, history and `/editor` do not get it.
- The card ends in a link line: the site icon, the host and the full path, then Copy link and
  Open in new tab. The site icon and the link line come from the link itself. Only the title,
  facts, description and picture come from the page.
- A slow page opens the card with loading bars and the link line, then fills it in place. With
  no data after 4 s, a web link shows the no-preview card below, and a docs.plus link says "No
  preview for this page."
- A docs.plus link has its own hovercard on the desktop pad. It covers a link to another pad, and
  a link to a heading, heading chat, chat message, filter, version or version history, in this pad
  or another one. The title says what the link opens, a quiet breadcrumb says where it lives, and
  a few counts follow, such as sections, messages or versions. A filter card names its terms in
  the title. A private pad you cannot open shows only "This document is private".
- Both cards run on the hyperlink extension's `hovercard` engine, which owns the timing, keys and
  frame. The pad draws its own content through the `render` option, so docs.plus never shows the
  extension's built-in card. It maps the frame's `--hl-*` tokens to the house tokens
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A web link with no preview now shows its full address and says why: the site does not share
  previews, the page has no title or summary, or the site did not answer. A file link with no
  preview names its type, such as a PDF or a spreadsheet. When a link's text names a
  different site from the one it opens, the card shows a warning
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- Settings → Appearance has a "Link previews" card. Its first switch is "Show link previews on
  hover" ([#242](https://github.com/docs-plus/docs.plus/issues/242)). It is stored per browser
  and is on by default. It turns off web and docs.plus cards alike, and it applies only while
  you are signed in.
- When a site blocked our server or did not answer, the no-preview link card offers **View
  archived copy**. One click asks the Wayback Machine for the closest copy, then shows an
  "Open archived copy" link that opens it in a new tab. The link goes to archive.org only on
  that click.
- A link whose text is its own web address shows a **Use page title** button on its hover card.
  One click puts the page title in place of the address and leaves the caret after it, so one
  undo brings the address back. The hover card's icon buttons, Use page title, Copy link and Open in new tab, now show a
  tooltip on hover.
  It shows only on a pad you can edit, for example on a link typed or pasted as a plain address
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A web link pasted on its own into a pad shows the page title in place of its address
  ([#681](https://github.com/docs-plus/docs.plus/issues/681)). The link appears at once with the
  address, and the title replaces it when our server answers. One undo brings the address back.
  ⌘+⇧+V (Ctrl+Shift+V) pastes the address as is. A file link shows its file name, such as
  "Q3 Report.pdf" or "archive.zip". A title that reads as another site's address keeps the
  address ([#682](https://github.com/docs-plus/docs.plus/issues/682)). The chat composer, history and `/editor` keep the address.
  The second "Link previews" switch, "Use page titles for pasted links", turns it off. Like the
  first, it is per browser, on by default, and applies only while you are signed in. The pasted
  link goes to our server, as for a link preview.
- A link to another docs.plus pad, pasted on its own into a pad, shows that pad's title
  ([#680](https://github.com/docs-plus/docs.plus/issues/680)). A heading link shows the heading,
  then the pad title, such as "Budget · Q3 launch plan". The title comes from a request with no
  sign-in, so a link to a Private pad keeps its address, even for its owner. Chat, message,
  filter and version links keep their address. The title is written once; a later rename does
  not change it. The third "Link previews" switch, "Use pad titles for pasted pad links", turns
  it off, with the same rules as the second. The service worker never caches the pad card reply,
  so an offline paste never writes a title from before the pad turned Private.
- A link to a part of this pad shows its kind icon: heading, chat, filter, version or top
  ([#174](https://github.com/docs-plus/docs.plus/issues/174)). A screen reader speaks the kind,
  such as "Heading". The link renders as a chip with a light primary tint. In headings and the
  Subtitle the chip has no block padding. In print it is plain link text.
- A filter link's preview names the filtered view, its match mode and every term, as wrapping
  pills ([#174](https://github.com/docs-plus/docs.plus/issues/174)). This holds in the desktop
  preview, the phone sheet and the chat link dialog. On desktop, Copy, Edit and Remove move to a
  row under the chip, next to "In this document".
- Every internal-link chip in the desktop preview has a spoken name, such as "Go to heading: Setup."
  ([#174](https://github.com/docs-plus/docs.plus/issues/174)). A chat chip's label leads with the
  quoted heading name.
- With the caret inside a link, Mod+K opens that link's preview. Focus goes to its title, or to
  the chip for a link into this pad. Escape returns focus to the editor at the same caret.
  Outside a link, Mod+K still opens the create form.
- Alt+Enter with the caret inside a link opens the link, in the pad and the chat composer. An
  external page opens in a new tab. Another pad opens in the same window, and a link to a part of
  this pad runs in place. Outside a link, the composer still treats Alt+Enter as Enter.
- Links in the pad and the chat composer keep the text cursor at rest. They show the hand only
  while Cmd (macOS) or Ctrl is held.
- In the desktop preview, the title of a web link carries the hint "Open in a new tab. Tip:
  ⌘-click the link." On other systems it says Ctrl-click. A link to another pad has no hint.
- The title, the chip and the buttons in the desktop preview show the house focus ring.
- The phone chat link dialog has an "Open link" first row for every web link except a link to
  a part of this pad. An external link opens in a new tab, and a link to another pad opens in
  place. `mailto:` and `tel:` links get no Open row.
- One link-metadata cache, `fetchMetadata.ts`, serves the click preview, the phone sheet, the
  hovercard and media unfurls ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
  Callers of one link share one request, and a hover that leaves still fills the cache for the
  click that follows.

### Changed

- Links in posted chat messages show the same icons as links in the document
  ([#516](https://github.com/docs-plus/docs.plus/issues/516)). A click on a
  message link opens the link preview: a popover on a computer, the Link sheet on a phone.
  Ctrl-click (⌘-click on a Mac) or a middle click opens a new tab. This also holds for a chat
  link to the open document, which used to jump inside the page
  ([#678](https://github.com/docs-plus/docs.plus/issues/678)).
- A link to another pad shows its address in the click preview and the phone sheet, not a
  scraped title. The pad's own card is the hovercard, and it knows who is reading.
- The privacy page now says how docs.plus uses, stores, shares and keeps the data that Google
  sign-in sends, and what closing an account removes. It says that names and profile photos are
  public, and it names DigitalOcean, the team mail for a new document, and Google Analytics
  cookies. It adds the Limited Use statement that Google's brand verification asks for.
- The privacy page now lists your data rights. It says how to download a document. It also says
  how to ask for a copy of your personal data, a correction, a deletion, or a limit on its use.
  The answer comes within one month.
- The privacy page now says more about links. A web link pasted into a document goes to our
  server, as a link preview does. For a GitHub repository or a Stack Overflow question, our server
  also asks api.github.com or api.stackexchange.com. A View archived copy click sends the link to
  archive.org, and our server keeps the answer for up to an hour. Link icons come from the site's
  main domain, in documents and in chat. `LEGAL_UPDATED` is now 4 November 2026.
- A plain click on a link to another pad now opens that pad in the same window, in the pad and
  in chat. Mod-click (Cmd on macOS, Ctrl elsewhere) and middle-click still open a new tab
  ([#359](https://github.com/docs-plus/docs.plus/issues/359)).
- `EditorContent` mounts the Tiptap editor hidden while `providerSyncing` is true, under the
  skeleton or `SyncErrorCard`. Mounted after the fill, its `createNodeViews()` rebuilt every
  block: 4 builds per cold load in dev and 2 in production. Now the fill builds once, and a
  sync error flip keeps the editor mounted. On a 2000-link pad, anchors created per load fell
  from 8004 to 2004, and the link-icon cost in the fill frame from +117 ms to +26 ms
  ([#516](https://github.com/docs-plus/docs.plus/issues/516)).
- A plain link in the pad and the chat composer underlines on hover, 1px thick with a 2px
  offset. Before, it faded to 85% opacity. A link chip never underlines.
- The desktop preview shows the link as its title at once, with no loading skeleton. The page
  title replaces it when it arrives.
- The chat link dialog's Edit row now reads "Edit link".
- Mod-click on a link in the text of the pad or the chat composer opens it in a new tab, with no
  preview.
  Before, it opened the preview, like a plain click.

- Heading slugs in a `?h=` trail use only `a-z`, `0-9`, `.` and `-`, and drop apostrophes, so
  "What's new" reads `whats-new`. The trail still joins slugs with `>`. A pad with no title, or a
  heading the pad no longer holds, gives a link with `id=` only and no empty `h=`.
- Filter and Focus section terms in the path are lowercase, and any run of spaces and hyphens is
  one `-`: `/demo/draw-a-diagram-with-text`, and "pre - war" is `/demo/pre-war`. The filter treats any run of spaces, tabs or hyphens as one
  gap, so an old `%20` link still filters, and `customer-research` also matches "customer
  research". A new link's chips show the path form; an old `%20` link shows the decoded words until the next filter change rewrites it.
- TOC Copy link writes two clipboard formats. Plain text keeps the encoded link with `%3E`, because
  some apps end a link at a raw `>`. A rich paste, as in Gmail or Google Docs, shows the trail with
  `>` and links to the full address.
- Copy to doc stores a message link as `?chatroom=&msg_id=`. A stored `?act=ch` link still opens
  its message. Before, under a filter, it stored the filter term as the pad name.

### Fixed

- A `/new` link in a pad now says what it does. Its click preview shows a "New document"
  chip that reads "Opens a blank document in a new tab", on desktop, in the phone sheet and in
  the chat composer dialog. The chip opens `/new` in a new tab, so the reader keeps their
  place, and the link shows the docs.plus logo. Before, the preview showed a bare "/new" with a
  broken site icon. `https://<app host>/new` works the same way.
- Desktop link Edit now finds the link after a co-editor types above it. Before, Apply did
  nothing in that case ([#678](https://github.com/docs-plus/docs.plus/issues/678)).
- **The Replace with a file warning names History.** It said there was no undo. History keeps
  the earlier version, and a restore brings it back. The warning also says that edits from the
  last minute may not be in History yet
  ([#662](https://github.com/docs-plus/docs.plus/issues/662)).
- **The link hovercard is wider, and its picture no longer pops.** The card is 24rem wide, and the
  picture keeps its 1.91:1 ratio. The card waits up to 300 ms for the picture. A later picture
  fades in, and a later failure folds the picture well away instead of removing it at once
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- **The link forms store the whole link without trailing punctuation.** The pad form and the
  chat link dialog store `toStoredLink(value)`, so `google.com,` becomes `https://google.com`.
- **The link form refuses a sentence.** `validateURL` from the hyperlink extension now accepts
  only one whole link. Before, `hello google.com` passed the pad and chat link forms.
- **Editing a link's URL no longer reverts a co-editor's link text.** When you leave the Text
  field untouched, Apply sends only the new `href`. Before, it sent the text from when the form
  opened.
- **Edit then Back no longer leaves a stale edit form.** The popover store now also clears the
  form when the open popover does not hold its host. Two examples are the preview after Back and
  a click on another link.
- **In the pad, Edit and Remove act only on the link they opened on.** The desktop and phone Edit
  forms and the phone sheet's Remove take the raw `href` the link had when they opened. They pass
  it to `getMarkRange`. If a co-editor's change moved another link under the stored position, the
  action does nothing. Before, Edit or Remove could hit that other link.
- **Chat embed thumbnails load through our server.** Vimeo, SoundCloud, Spotify and
  Loom thumbnails in chat and in Insert media now come from `GET /api/metadata/image`.
- **The chat icon in the phone TOC drawer opens the chat on iPhone Safari again
  ([#639](https://github.com/docs-plus/docs.plus/issues/639)).** The tap closes the drawer, and
  the drawer pops its history entry. Safari lands that pop about 90 ms later, after the chat pane
  had pushed its own entry, so the pop closed the chat. `useChatPaneHistory` now waits for that
  pop (`whenHistoryDismissSettles`) before it pushes.
- **The offline mirror stays at one row
  ([#638](https://github.com/docs-plus/docs.plus/issues/638)).** y-indexeddb stores a full doc
  copy on each load and trims only past 500 rows. `useYdocAndProvider` now merges the store to
  one row with `storeState`, 2 s after the first sync. On a 2000-link pad, 20 reloads used to
  leave 42 rows (22.6 MB) and a 202 ms replay frame. Now the store stays at 1 row (0.55 MB),
  and a replay after the fill costs about 8 ms of script.
- **The Documents list shows member faces and the roster on older documents
  ([#574](https://github.com/docs-plus/docs.plus/issues/574)).** The faces and the roster
  now send the `documentId` exactly as stored. They used to send `lower(documentId)`, which
  matched no workspace made before 2026-08-09. Needs Supabase migration `20261023120000`.
- **Opening a link preview no longer changes the document
  ([#519](https://github.com/docs-plus/docs.plus/issues/519)).** Peers get no update, and the
  change digest no longer counts it.
- **The phone edit toolbar stays hidden when the pad is read-only
  ([#308](https://github.com/docs-plus/docs.plus/issues/308)).** An input that opened the
  keyboard in read mode used to show edit controls.
- **The skip link stays first in Tab order after a heading deep link
  ([#309](https://github.com/docs-plus/docs.plus/issues/309)).** On desktop, the first Tab
  went to a TOC row. It now goes to "Skip to main content".
- **Tab stays inside a bottom sheet while the sheet opens
  ([#310](https://github.com/docs-plus/docs.plus/issues/310)).** Focus moves into the sheet on
  its first visible frame. The sheet backdrop is no longer a Tab stop.
- **A push notification click marks the notification read when it opens a new window
  ([#312](https://github.com/docs-plus/docs.plus/issues/312)).** The bell and the app icon
  badge used to keep the old count.

- **Copied links no longer carry your open filter, chat or heading.** TOC Copy link, the chat
  breadcrumb's link, chat Share, Copy link in Bookmarks and Notifications, and the link picker now
  build from the pad's own address. Before, a heading link copied under a filter kept the filter
  path. Report no longer mails the filter terms either.
- **A notification row names the document, not a filter term.** It read the last part of the
  link's path, which can be a filter term.
- **A stale `?msg_id=` no longer opens another room at that message.** The address's message id
  anchors a chat only when the address names that room.
- **A tap on a heading in the phone TOC drawer keeps the heading in the address.** The drawer
  closes by going back one history entry, and that step undid the heading write. Pad URL now waits
  for the step to land, then writes.
- **A filter link with `%25` in a term no longer throws.** The filter decoded each term twice, so
  `/demo/100%25` failed.
- **The slash menu keeps the keyboard up on Android.** The menu closed about 600 ms after `/`,
  the keyboard dropped, and the pad left edit mode. The slash sheet turned on Chrome's keyboard
  overlay mode, so the pad read the keyboard as closed
  ([#251](https://github.com/docs-plus/docs.plus/issues/251)).
- **The phone link editor keeps edit mode on Android.** It hit the same overlay mode, so the URL
  field lost focus and Apply left the user out of edit mode. Every sheet that keeps the pad's
  keyboard up now skips the library's keyboard handling on Chromium and stays above the keyboard.
  The URL field also takes focus as soon as the sheet shows.
- **A phone sheet returns focus to the pad link that opened it.** Close used to leave focus on
  the page body. The sheet also lets go of its opener before it hides the page, so screen readers
  no longer see the pad header under a sheet opened from the TOC drawer
  ([#248](https://github.com/docs-plus/docs.plus/issues/248)).
- **Shift+Tab wraps inside a phone sheet.** It used to stop on the sheet itself and a hidden guard,
  and never reached the other controls ([#310](https://github.com/docs-plus/docs.plus/issues/310)).

### Security

- **Site icons no longer come from Google
  ([#517](https://github.com/docs-plus/docs.plus/issues/517)).** Profile links, Settings links and
  link previews load site icons from the docs.plus server. Before, each icon sent the reader's IP
  address and the site's origin to Google. A new Settings link no longer stores a fallback favicon
  URL. The privacy page now has a "Link icons" section.
- **A new Settings link stores only the page's title and description
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).** `sanitizeMetadata` no longer
  keeps the site's own icon address or theme color, which nothing read. Links saved before keep
  them, unread.

### Internal

- One module, Pad URL (`services/padUrl.ts`, over the shared package `@docs.plus/pad-url`), builds,
  writes and reads every pad address. `link` builds from the pad's own address, `go` changes the
  address bar and picks the history writer, and `read` also parses old link forms. It replaces
  `utils/filterRoute.ts`, `utils/stripChatDeepLinkFromUrl.ts`, `hooks/usePadShareUrl.ts` and the
  `APPLY_FILTER`, `REMOVE_FILTER` and `RESET_FILTER` topics in `eventsHub`.
- The link metadata cache stores a `LinkCard`, whose image URL is already our image route. No
  caller can reach the scraped image URL, so the privacy rule holds by type
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- `linkDestination` lives in `internalDocumentLink.ts`, which loads no router or Supabase. Link
  edit and remove take a required `expectedHref`, so the chat link dialog checks the stored
  href too.

## [2.2.0] — 2026-10-22

This entry holds the pad UI notes for this package. The highlights of the
release and the self-hosting steps are in the
[root CHANGELOG](../../CHANGELOG.md).

### Added

- **Mermaid diagrams in the pad, History and `/editor`.** Type a
  ` ```mermaid ` fence, or pick Diagram from the slash menu or the Code
  select, which inserts a starter example. The live diagram draws under the
  source. Writers start with the source open. Read-only views, History and
  visitors start with it folded, and each viewer's choice is remembered. The
  head shows Syntax, Copy and Hide source on hover. The SVG is sanitized, and
  print shows the drawn diagram. A diagram over 10,000 characters or 250 edges
  names the limit it hit. The PWA does not precache the renderer
  ([#528](https://github.com/docs-plus/docs.plus/issues/528), [#529](https://github.com/docs-plus/docs.plus/issues/529)).
- **Set up a terminal agent from Settings › Connected apps
  ([#548](https://github.com/docs-plus/docs.plus/issues/548)).** On a
  computer, the MCP server card now ends on a grid: Claude Code, Codex,
  Copilot CLI and Cline. Each cell copies that agent's add command. A last cell, **Any other agent**,
  copies a short prompt that tells the agent to show each change and wait
  for a yes. The **Other** tab gains **Add to LM Studio** and **Add to
  Replit**.
- **A public `/mcp` page shows the MCP server URL and how to add it to each
  AI app** ([#458](https://github.com/docs-plus/docs.plus/issues/458)). The
  sitemap lists it, and the home footer links it as **AI apps**. A document
  named "MCP" now opens on a random slug, because `mcp` is a reserved slug.

### Changed

- **Add an AI app has three tabs: Claude, ChatGPT and Other
  ([#548](https://github.com/docs-plus/docs.plus/issues/548)).** The Claude
  Code and Codex tabs are gone, because the terminal agent grid now holds
  their commands. A web link in **Other**, such as Replit, opens in a new
  tab, so Settings stays open.
- **The consent page names Cursor
  ([3eef1c98b](https://github.com/docs-plus/docs.plus/commit/3eef1c98b)).** A
  Cursor sign-in now shows **Returns you to www.cursor.com**, not the
  unverified warning. Its Settings row still reads **On this computer**,
  because Cursor also registers a local address.

### Fixed

- **Online status stays correct across tab switches and reloads.** The status
  writer keys on the signed-in user, waits before it writes OFFLINE, and logs a
  failed write ([#492](https://github.com/docs-plus/docs.plus/issues/492)).
- **The @ picker shows the same online people as the avatars**
  ([#493](https://github.com/docs-plus/docs.plus/issues/493)).
- **Hyperlink suggestions no longer ask for bookmarks before sign-in**
  ([#318](https://github.com/docs-plus/docs.plus/issues/318)).
- **A failed access change cannot write an old pad's data back
  ([633972f69](https://github.com/docs-plus/docs.plus/commit/633972f69)).**
  After a pad switch, the rollback now does nothing.
- **Add link (Mod-K) with nothing selected inserts the typed URL as the link
  ([1dac1cf64](https://github.com/docs-plus/docs.plus/commit/1dac1cf64)).**
  Before, Apply showed "Please enter a valid URL" and inserted nothing.
- **The Discord links point at a working invite** ([#480](https://github.com/docs-plus/docs.plus/issues/480)).
- **The `font-mono` utility works
  ([ebdc6cd47](https://github.com/docs-plus/docs.plus/commit/ebdc6cd47)).**
  The global `font-family` rule now sits in the Tailwind base layer, so a
  font utility can override it. URLs and commands on `/mcp` and in Settings ›
  Connected apps now show in a monospace face.
- **The Codex command opens one sign-in
  ([5af33da38](https://github.com/docs-plus/docs.plus/commit/5af33da38)).**
  `codex mcp add` already starts the sign-in. The 2.1.0 Codex tab also told
  you to run `codex mcp login`, which opened a second one. The grid copies
  only `codex mcp add`.

### Security

- **A Private document's images load only for its owner ([#439](https://github.com/docs-plus/docs.plus/issues/439)).**
  After sign-in and on each token refresh, the webapp asks the REST API for the
  media cookie that the image requests carry. Sign-out clears it. An image that
  loads before the cookie arrives retries once after it does.

### Internal

- One Presence awareness room is the only writer of presence faces
  ([8527f1540](https://github.com/docs-plus/docs.plus/commit/8527f1540)).
- One Pad session opens a pad; the duplicate `workspaceId` store field is gone
  ([633972f69](https://github.com/docs-plus/docs.plus/commit/633972f69)).
- One module answers every read-side owner question (`isDocumentOwner`)
  ([d9cf3df7d](https://github.com/docs-plus/docs.plus/commit/d9cf3df7d)).
- One Settings opener owns open state, the tab and hash intake for all hosts
  ([b0ae382fc](https://github.com/docs-plus/docs.plus/commit/b0ae382fc)).

## [2.1.0] — 2026-10-13

This entry holds the pad UI notes for this package. The highlights of the
release and the self-hosting steps are in the
[root CHANGELOG](../../CHANGELOG.md).

### Added

- **A QR code for the pad from the desktop toolbar.** A new toolbar toggle,
  after Filter, shows a small QR code at the top right of the workspace. It
  encodes the same clean pad link as the share card, with no heading, chat or
  Filter terms. The card sits 14px under the toolbar, and below the Find bar
  while Find is open. Hover the card to show a resize handle on its
  bottom-left corner. Drag it to size the code from 128px to 1024px, or less
  when docked chat or Find needs the room. The white margin stays thin at
  every size. A click on the handle switches between 128px and the largest
  size that fits. The arrow keys, Home and End work too. Hiding the card sets
  it back to 128px. A Private pad shows no QR, and the toggle is off there.
  The card always shows while the toggle is on. On a narrow window, it may
  cover the page's right margin. Nothing is saved: a reload or another pad
  hides it ([#377](https://github.com/docs-plus/docs.plus/issues/377),
  [#465](https://github.com/docs-plus/docs.plus/issues/465)).

- **Settings sync across your tabs and devices.** A setting you save shows in
  every open tab and on every device where you are signed in. A field you are
  still editing keeps your change. When two devices save different settings
  at once, both changes stay. The theme stays per browser, and every open tab
  of that browser follows it.

- **A red dot on Bookmarks shows that In progress holds items.** The dot shows
  on the desktop toolbar and in the phone outline, before you open the panel.

- **OAuth consent page at `/oauth/consent`.** It asks "Allow Claude to use
  your docs.plus account?" and shows the signed-in account. It lists what
  the app will be able to do. It can read the documents you can open and
  their chat. It can create documents, and a new document is public. It can
  edit or post only in documents you own. Trust follows the redirect URI,
  never the name the app registered. Claude's and ChatGPT's exact callbacks
  show "Returns you to claude.ai" or "chatgpt.com". A `localhost`,
  `127.0.0.1` or `[::1]` redirect is marked as an app on this computer. Any
  other redirect gets a warning with its address, and the name in quotes.
  The buttons are **Cancel** and **Allow**. A redirect with a script scheme
  is refused. The `phone` scope adds no line, because no docs.plus account
  holds a phone number.
- **Settings has a Connected apps tab.** `#settings?tab=connected-apps`
  opens it. **Apps with access** lists the apps the person allowed, one row
  per app. A row says "Returns you to claude.ai" only when every registered
  redirect is that app's exact callback. `GET /api/connected-apps/redirects`
  supplies the redirects. Only such a row shows the brand mark. A loopback
  app is marked **On this computer**, and any other app **Unverified app**.
  An app that borrows a known name gets its own unverified row. It never
  loads an app's logo or links its address. **Disconnect** asks first, then
  revokes every connection in the row. The dialog says the app may keep what
  it read, and to remove the connector in the app too. For a row that is not Claude or
  ChatGPT, the button's `aria-label` and the dialog add "(unverified)" or
  "(on this computer)" to the name. The redirect lookup stops after 8 s. If
  it fails, every row shows **Unverified app**, and **Disconnect** stays.
  The card hides while the list loads or is empty.
- **The Connected apps tab opens with the docs.plus MCP server.** One short
  card shows the MCP mark and a live status: Online, Unreachable, or You're
  offline. It also has a **Setup guide** link. One row of chips shows what a
  connected AI app may do: read, create, edit and chat. The status only
  proves this browser reached the MCP service. The service worker never
  answers that check from its cache. **Apps with access** follows, then
  **Add an AI app**.
- **Add an AI app has one tab per app: Claude, ChatGPT, Claude Code, Codex
  and Other.** Each tab label carries the app's mark. Every tab but Other
  shows numbered steps.
  **Add to Claude** and **Open ChatGPT** copy the server URL and open the
  app in a new tab. Every tab ends on the consent-page check: the return
  address, or "an app on this computer". Claude opens its Add custom connector dialog with
  docs.plus filled in. That link is undocumented, so the copied URL is the
  fallback. Each value to copy sits in a code box with its own **Copy**.
  That covers the terminal commands, the server URL in ChatGPT step 2, and
  the MCP server URL in **Other**. **Other** also holds Add to Cursor and Add
  to VS Code. On a phone the
  card has no tabs: it shows the MCP server URL and says to add apps on a
  computer.
- A title such as "Privacy" or "Terms" no longer opens a document on the
  homepage. `privacy`, `terms`, `oauth`, `c` and `receive` are now reserved
  slugs, like `editor` and `new`. The `/oauth` and `/receive` routes are new,
  so a document that used either slug no longer opens.
- A primary `CopyButton` turns green when the copy succeeds. Before, it put
  green text on a blue button.
- **A transparent 96 px site icon.** Claude draws a connector's icon from
  Google's favicon service, on a dark tile. The opaque white icons showed
  there as a white square. `icon-96x96.png` is the logo with no background,
  and the page links it. `icon-192x192.png` is the same logo, kept as the
  file to upload in connector dialogs. Google refreshes its copy only after
  it crawls docs.plus again.
- **Settings → Security shows how you sign in and which apps have access.**
  **How you sign in** lists Google, Email link or both, from the account's
  identities, and says "docs.plus does not use passwords. Sign in with Google
  or an email link." **Apps with access** says how many AI apps can use the
  account, and it shows only when an app is connected. **Review connected
  apps** opens the Connected apps tab. The
  Account email card now uses sentence case.
- **/privacy has a Connected AI apps section.** It says what a connected app
  can read and change, and what it receives. It says what docs.plus records
  for each tool call, and how to stop an app. `LEGAL_UPDATED` is now
  28 September 2026.
- **The installed app icon shows the unread notification count.** A failed
  count fetch returns `null`, not `0`, so an error never clears the badge.
  Sign-out clears it.
- **iOS launch splash screens** for the installed app, linked by device size.
- **Home shows your documents and an Install app button.** A signed-in person
  sees the first 8 rows of the list in Settings → Documents. The list holds
  documents you own and documents you joined. Home and Settings share the Show and sort
  picks. Rows have avatars, the ⋮ menu, date groups, and Delete with Undo.
  With more than 8 rows, **See all** opens Settings → Documents. On a phone,
  Rename opens a dialog. **Install app** shows when the browser can install
  docs.plus.
- **The status chip warns "No offline copy"** when the browser stops saving
  the local copy of the pad.

- Your own empty profile card keeps one row: "No bio or links yet." and
  Add bio and links. The button opens Settings on Profile.

- History paints the latest Pad title rename above the editor. Chat paints
  the live username, then the snapshot name if the users join is missing.
  A Documents-list rename of the open pad writes the header and relays the
  room when a provider exists.

- `AvatarStack` `showActivity` paints an activity chip (`Icons.emoji` or
  `Icons.mic`) on a face's top-right corner, in `ParticipantsList` and
  `TocRowTrail`. It pops in over 200 ms, then plays `avatar-typing` 6 times
  (4.8 s, under the 5 s line in WCAG 2.2.2). The wire is `startActivity` /
  `stopActivity` on `typingIndicator`: 300 ms start delay, 3 s keepalive, 8 s
  expiry.

- `TocTickRail` is the desktop tick rail, a session-only 32px heading map.
  `DesktopEditor` deep-imports it into the `.editor` pad row, so docked chat
  can span the pad. `useTocResize` runs
  `wide | rail | drag | settle-to-rail | settle-to-wide`, and `stepTocRelease`
  is its only release step. A release under `TOC_SNAP_WIDTH` (120) snaps to
  the rail. A release from 120 to 240
  paints 240 for this session only. `docsy:toc-width` keeps only the last
  committed wide width over 240. A stored value at or below 240 reads as
  missing and opens at 320. The section preview is an L1 card
  (`popoverPanelClassName`) that clones the live section from
  `editor.view.dom`. A focused tick holds the preview only while it matches
  `:focus-visible`. `focusHeadingChatTrigger` falls back to the rail reopen
  button (`data-toc-rail-reopen`) and skips a trigger that cannot take focus.

- `ScrollArea` takes `fade` (`start`, `end` or `both`). `useScrollOverflow`
  sets `data-scroll-overflow`, and `_scrollArea.scss` paints an alpha
  `mask-image` only on an edge with hidden content. The desktop TOC passes
  `end`, so the sticky title row stays whole. `TocModal` passes `both`.
  `TocDesktop` portals its `DragOverlay` to `document.body`, so the mask does
  not clip the drag card.

- `DocumentSettingsPanel` shows a Follow toggle through `useDocumentFollow`
  for a signed-in reader, when `showFollow` is true. The owner of a Private or
  Read-only document does not see it, because nobody else can edit.
  `useDocumentFollow` stays disabled while Follow is hidden.

- History loads its list in pages. `HistorySidebarBody` renders a Show older
  versions footer while `historyHasMore` is true. `fetchOlderHistory` sends
  `history.list` with `beforeVersion` set to `historyNextBefore`. An
  older-page reply for a cursor the store has moved past is dropped. A
  first-page re-list keeps the older pages when the new page reaches the old
  head. Otherwise the page and its cursor replace the list. A refused or
  failed Show older keeps the sidebar. While older pages exist,
  `HistorySidebar` shows `{count}+ versions` and the desktop sidebar always
  virtualizes. A `rate-limited` watch clears both pending watch slots, stops
  loading, and shows an info toast. It does not evict the row or request the
  next one.

- History list and watch replies echo the request's `since`, `version` and
  `beforeVersion` on `HistoryStatelessPayload`. `sendHistoryListRequest` takes
  `{ beforeVersion, since }`, and `fetchHistory` sends `pendingCompareSince`
  as `since`. A `since` list reply stores its Anchor in `historyAnchor`
  (`{ since, item }`), never in `historyList`. `useArmPendingHistoryCompare`
  arms compare from that Anchor. When no Anchor arrived and no loaded row sits
  at or before Last left, it sends one silent list with `since`. It first
  waits for any silent list in flight and for `HISTORY_LIST_GAP_MS`. It
  retries a refusal once, then opens no compare. A watch failure goes to
  compare only when its `version` equals `pendingCompareVersion`. A failure
  whose echo names neither slot is dropped. Only a first page can be silent,
  so an older-page frame never clears `silentListRefresh`. A reply with no
  echo keeps the old path.

- A `#history?version=` link below the loaded pages loads older pages,
  `HISTORY_LIST_GAP_MS` apart, until the version arrives. Only then is the
  link judged unavailable. `loadingHistory` stays true during the walk, and
  `resetHistorySessionForMount` cancels it.

- **Settings → Documents lists the documents you joined.** One list shows
  the documents you own and the ones you opened while signed in. A **Show**
  menu beside the sort picks All documents, Owned by me or Joined, and the
  browser tab keeps your pick. A document you do not own shows its owner's
  name. Its ⋮ menu offers only Open in new tab and Copy link. Joined has its
  own empty state. Command jump still lists only your own documents.

- **Find text in the open pad.** On a computer, ⌘F (Ctrl+F) opens a small
  Find bar at the top right of the editor column. The page does not move when
  Find opens. Enter or ⌘G steps to the next match. Shift+Enter or Shift+⌘G
  steps back. Escape closes the bar. On a phone, Find is in the outline
  drawer ([#393](https://github.com/docs-plus/docs.plus/issues/393)).

- **A slash menu inserts a block.** Type `/` on an empty line, then type to
  filter the list. It offers Heading 1 to 6, Subtitle, Normal, Bullet list,
  Ordered list, Task list, Blockquote, Code block, Picture and Link to a
  section. It opens only when the `/` text fills the whole line, so a `/` in a
  path stays text. It never opens in the title, in a code block or in a locked
  pad. On a phone, the list opens as a bottom sheet
  ([#251](https://github.com/docs-plus/docs.plus/issues/251)).

- **Command jump opens a place or one of your documents.** Press ⌘⇧K
  (Ctrl+Shift+K) on Home or in a pad, and press it again to close. Type to
  filter, then press Enter. The places depend on the page. They include
  History, the Settings tabs, Filter, Find in document, Notifications, New
  document and Demo. A signed-in person also sees the documents they own, by
  Last opened. Command jump never lists a document you only joined
  ([#254](https://github.com/docs-plus/docs.plus/issues/254)).

- **Share a file to docs.plus from the system share sheet.** The installed
  app takes Word (.docx), Markdown (.md, .markdown) and plain text (.txt)
  files. The file opens as a new document that you own. A signed-out person
  signs in first, and then the file opens. The `/receive` page shows the
  import, and it can offer Try again when the import fails. Chat Share now
  uses the system share sheet where the device has one.

- **Export asks where to save the file.** In a browser with a save picker,
  such as Chrome on a computer, Export opens it with a suggested file name.
  Cancel in the picker stops the export. On iOS, Export opens the share sheet.
  Other browsers download the file as before.

- **The pad has a skip link, and sheets hold the keyboard focus.** A **Skip to
  main content** button is the first Tab stop on a pad. It moves focus to the
  editor area. Most bottom sheets, and the outline and history drawers, are
  now named dialogs. Escape closes them, and focus returns to the control
  that opened them.

- **Settings has a Report a problem row on a pad.** The row sits in the Open
  source group, after Report an issue. It shows only on a pad. It opens an
  email to the published contact address with the pad link. The email carries
  no document text, title or profile data.

### Changed

- **/privacy names Resend as the email provider.** Resend sends sign-in,
  notification and digest mail. Supabase sends sign-in links through Resend.
  A new "Where mail data goes" section says that Resend sends from Ireland
  and stores mail data in the United States. It says that the mail carries
  short extracts of document and chat text, and it names the transfer
  safeguards. Resend keeps sent mail and the mail logs for 30 days.
  `LEGAL_UPDATED` is now 12 October 2026 ([#424](https://github.com/docs-plus/docs.plus/issues/424), [#425](https://github.com/docs-plus/docs.plus/issues/425)).
- **Every click menu now works like the right-click menus.** The Documents ⋮
  menu in Settings and on Home has four groups. They are Open in new tab and
  Copy link; Rename, Duplicate and Favorite; Private and Read-only; and Delete.
  Private and Read-only are check rows inside the menu. The image viewer's ⋯
  menu, the toolbar list menus and the media toolbar ⋯ use the same menu rows.
  They take arrow keys and Escape, and show a visible keyboard focus ring. On
  a phone, these menus open the standard bottom sheet. Toolbar overflow
  buttons show ⋯, and row menus show ⋮ ([#391](https://github.com/docs-plus/docs.plus/issues/391)).

- **The heading chat button shows while the pointer is over its section.** On
  a desktop, the button shows anywhere over the heading and the blocks under
  it. A block under a nested heading shows only that heading's button. The
  button leaves when the pointer leaves the section or the document sheet
  ([#372](https://github.com/docs-plus/docs.plus/issues/372)).
- **One order for the chat message menus.** The hover ⋯ menu now lists Copy
  link, Download, Copy to doc, Edit and Delete in the same order as the
  right-click menu. Screen readers no longer read the "seen" footer as a
  disabled action. On a phone, the long-press menu has 44px rows and closes
  with Escape.
- **Open the outline and chat menus from the keyboard.** Press Shift+F10 or
  the Menu key on a focused outline row, or on a link in a message. The menu
  opens at that item, with its first row focused. Screen readers name the
  menus "Section options" and "Message options". In the outline menu, Delete
  section loses its info icon, and Chat room uses the default row colour. A
  right-click on the outline header or on empty chat space now shows the
  browser's own menu ([#391](https://github.com/docs-plus/docs.plus/issues/391)).

- **An empty line's hint now shows only its heading chain.** It no longer ends
  with `> Write here`. Every pad hint and the Title hint use one grey, a little
  darker than before. That grey passes 4.5:1 contrast in every theme. The chat
  composer hint does not change.

- **Settings → Documents shows Trash only when the trash holds a document.**
  When the last document leaves the trash, the list comes back.

- **One Time zone field.** Each zone reads like "(UTC+03:30) Tehran", and you
  can search by city or country. When the saved zone is not this device's
  zone, **Use this device's time zone** sets it back.

- Notification settings are now private to your account.

- **The app has one calmer, consistent look.** Sign-in, app consent, access
  gates and error pages share one card, with a clear title and one main
  action. Every confirmation uses one dialog, with Cancel first and the action
  last. Dialogs, menus and phone sheets now look and behave the same. Labels,
  hints and links are easier to read, with stronger contrast in every theme.
  Form fields show a label above, help below and a clear error. Empty lists,
  loading states and notices share one look. Screen readers and keyboards get
  better names, roles and focus rings. Emails have readable text contrast, and
  the admin dashboard theme now matches the app.

- The share card is wider, with the new QR code on the left. Hover the code
  to show a fullscreen button over a light blur. The card no longer shows the
  document name. The footer line says what anyone with the link can do, and
  the owner sees Change.

- **History marks a connected app's version.** A version an MCP tool wrote
  shows a "Connected app" badge, and its writers note says the writers were
  not recorded.

- `useVoiceRecorder` takes `onSend` and returns `sendPreview` and `discard`,
  not `onAttach`, `confirmAttach`, and three reset paths. `useSendVoiceWhenReady`
  sends a released note once its tile is ready. `addFiles` returns the ids it
  queued and creates each row before its upload starts. `MessageMediaItem`
  gains `duration` and `waveform`, which `readAudioShape` sets for voice notes.
  The pure `stepVoiceNote` (`MessageComposer/helpers/stepVoiceNote.ts`) now
  owns every voice transition. It returns the next state and a list of
  effects, and `useVoiceRecorder` runs them in order inside `dispatch`. A
  `VoiceMicRequest` object tracks each microphone request, so `startHold` and
  `startLockedFromMenu` are synchronous. The hook no longer returns
  `elapsedMs` or `isActive`. The overlay helpers
  `registerComposerVoiceStop` and `stopComposerVoiceRecording` are now
  `registerComposerVoiceDiscard` and `discardComposerVoiceNote`.

- `useComposerModeEdge` turns reply, edit and comment memory into one
  `ComposerModeEdge` per change: the new mode, `draftLoad` (`keep`, `fill` or
  `replace`) and `discardModeAdded`. Mount counts as an edge. The pure table
  is `composerModeEdgeAction`. `useComposerDraft` and
  `useComposerAttachmentLifecycle` read the edge, not the three memories. One
  behavior changes: a switch between reply and comment now deletes the
  uploads that the mode you leave added. Before, they stayed until the daily
  orphan cleanup.

- The sign-in form checks the email on rest-api, not on Next.

- The composer + menu is a dialog named Insert, with plain buttons and no
  menu roles.

- On a phone, the small composer controls grow to 44 px (`min-h-11 min-w-11`).
  Each attachment tile gets a 44 px remove button beside it.

- An own optimistic chat row carries `data-status` (`pending` or `failed`) on
  the card root. The status paints in the timestamp slot.

- `useResizeContainer` snaps the docked chat sash like `useTocResize`. Its
  modes are `open | drag | settle-to-min | settle-to-close`. Below 320 px the
  paint follows the pointer and the inner column fades. A release under
  `CHAT_SNAP_HEIGHT` (160) settles to 0, then calls `closeHeadingChatroom()`.
  A release from 160 to 320 settles back to 320. Both settles use
  `--motion-overlay-in`. Under reduced motion an abort writes 320 to
  `style.height` itself, because React skips a `paint` that is already 320.
  The stored height never goes below 320.
  `useSyncChatPanelHeight` replaces `useAdjustEditorSizeForChatRoom`. It writes
  `--chat-panel-height` on `.editor` before the tick rail paints.

- Copy success fades to a check through daisyUI `swap` / `swap-active`, not a
  keyed remount with `doc-region-in`. `CopyButton` drops its scale transition.
  A menu or sheet that closes after a copy holds for `COPY_FADE_HOLD_MS`
  (`MOTION_PANEL_MS × 2`) through `useCloseAfterHold`, and only after a
  successful copy. Documents ⋮ cancels that hold when another action runs. The
  chat `NotificationToggle` stacks its three icons by opacity and is disabled
  while an update is in flight. TOC Copy link, gallery copy and chat file-card
  copy stay hard cuts. In `LinkPreviewSheet`, Copy link wraps its `swap` in a
  `flex-1` span, because `.swap` centers its content. `useCopyHistoryVersionLink`
  runs on `useCopyToClipboard`, and `copyHistoryVersionLinkToClipboard` is gone.

- `useVersionRestore` returns `allowRestore`: a profile and no editing lock
  (`selectDocumentEditingLocked`), the same gates as `history.revert`. Without
  it the Restore control is hidden and an open confirm closes. The "Sign in to
  restore a version." toast is gone.

- Every chat message menu renders `MessageActionMenuList`: right-click, hover
  ⋯ and long press. The titles live once, in `useMessageActionMenuItems`:
  Copy link, Copy to doc, Edit and Delete. Copy link no longer becomes Share
  message link on a message with files. Edit sits above Delete in every menu.
  `MessageActionMenuItem` and `MessageActionMenuItemId` live in
  `MessageCard/hooks/messageActionMenu.ts`. Chat confirms open through
  `GlobalDialog`, and the chat room has no dialog host of its own.

- Editors send far fewer cursor updates. An unchanged cursor is no longer sent
  again after each remote edit, and a received cursor update is no longer
  sent back. Both come from upstream bugs (`@tiptap/y-tiptap` [#55](https://github.com/ueberdosis/y-tiptap/issues/55) and
  `@hocuspocus/provider` 3.x).

- On a phone, the Settings → Documents ⋮ menu opens the app's standard
  bottom sheet. Settings stays open behind it.
- Chat toolbar buttons show the app's tooltip. The close button reads
  "Close chat".
- A document with 4 members shows all 4 faces. Past 4, the row shows 3 faces
  and the count of the rest.

### Fixed

- **A phone no longer offers link edits on a read-only document.** The link
  preview sheet hides Edit link and Remove link there, as the desktop popover
  already did. Open and Copy link stay.

- **The pad loading skeleton matches the loaded pad.** The document bones stay
  inside the sheet. The outline skeleton draws thin title lines on the
  real row positions, with nest rails, instead of filled slabs. The signed-out
  header shows History and Theme bones. On a phone, the page floor keeps its
  colour through the load ([#463](https://github.com/docs-plus/docs.plus/issues/463)).

- **Chat, panels and popovers share one skeleton look.** Text bones are plain
  lines, not pills. The tab track bones show in every theme. The Filter,
  Document settings and Insert media loaders open with the real panel header,
  so the header does not move when the panel loads. The link preview loader
  uses the house skeleton ([#464](https://github.com/docs-plus/docs.plus/issues/464)).

- **History, link pickers and the outline preview load in place.** The
  History sidebar and its Authors tab show bones in the real row positions.
  The History toolbar keeps its copy-link button and shows bones for the
  version text. Show older versions shows a spinner and sends one request.
  The outline preview card uses the real paddings and does not open when a
  section has nothing to show. The link preview, the mobile Link sheet, the
  link suggestions and Command jump show bone rows like their loaded rows.
  An upload left unfinished by an earlier session now says so, with Remove,
  instead of a spinner that never ends ([#463](https://github.com/docs-plus/docs.plus/issues/463), [#464](https://github.com/docs-plus/docs.plus/issues/464)).

- **Chat media and emoji keep their place while they load.** A feed image
  keeps its bone until the image has loaded, and mosaic bones have square
  corners. The audio bar, the file card copy slot and the lightbox slides load
  at their real size. Emoji-only messages and reaction pills keep their size
  before the emoji paints. The reaction sheet holds the picker height. The
  emoji-mart picker and its data no longer load with the app shell, because
  the picker loads them in its own chunk. Comment embed previews load on the
  real line sizes and gaps, and a failed stacked preview shows the image tile
  ([#463](https://github.com/docs-plus/docs.plus/issues/463), [#464](https://github.com/docs-plus/docs.plus/issues/464)).
- **The chat loaders match the loaded chat.** Feed bones sit where the
  avatars, names and lines land, with no tinted panel. The day separator
  keeps its two hairlines. The composer skeleton draws the placeholder line,
  not a filled field. A non-member sees the Join bar as soon as the channel
  loads. The breadcrumb keeps its real chevron and ends on a deleted heading.
  Participants show at once. The notification toggle shows a bone while it
  reads its state. A live message from another person now shows its author's
  name. A jump to a reply, a pin or the latest messages shows a spinner while
  it loads ([#464](https://github.com/docs-plus/docs.plus/issues/464)).
- **Settings loaders match the loaded settings.** The Settings skeleton shows
  the tab that will open, so the toolbar opens on Documents bones. With a
  named tab, a phone shows that tab's pane. Each section skeleton draws the
  real cards, headers, fields and rows, including your saved links and
  sign-in methods. Document settings opens its loader with the first card
  open and the same rows that the panel will show. Trash, the people list and
  the profile dialog keep their real line heights. The push and Follow
  switches show a bone while their state loads. Try again shows that it is
  busy while it reloads. The Documents list dims while it reloads, also with
  reduced motion on ([#463](https://github.com/docs-plus/docs.plus/issues/463), [#464](https://github.com/docs-plus/docs.plus/issues/464)).
- **Panel loaders match the loaded panels.** The Bookmarks and Notifications
  loaders keep the real body height, so the popover does not jump when the
  feed loads. Feed card bones keep the real preview frame and a slot for the
  Copy link button. The Notifications loader shows Mark all read only when
  you have unread notifications. A bookmark image shows a bone of the thumb
  size while its link loads, and offers a retry if the link fails. The Filter
  and Insert media loaders use the real body padding, and Insert media no
  longer draws a drop zone ([#463](https://github.com/docs-plus/docs.plus/issues/463), [#464](https://github.com/docs-plus/docs.plus/issues/464)).
- **The phone outline drawer shows its frame while the pad loads.** Before
  the first sync, an opened drawer showed only the dimmed page. It now shows
  the header, the document title, the footer and outline bones at the phone
  row size. Find stays disabled until the editor is ready. Bookmarks no
  longer pops into the footer late for a signed-in user. On a computer, the
  outline no longer fades in after its bones ([#463](https://github.com/docs-plus/docs.plus/issues/463)).

- **The pad skeleton is in the first page load again.** The page shows the
  loading skeleton before any script runs. The skeleton header and toolbar
  now match the loaded ones control for control. The loaded header, the Edit
  button and the document no longer fade in when the skeleton leaves. A
  signed-in reader no longer sees Sign in while the profile loads; the avatar
  slot holds a round bone ([#463](https://github.com/docs-plus/docs.plus/issues/463), [#464](https://github.com/docs-plus/docs.plus/issues/464)).

- **The Add link form takes your typing at once.** After you select text and
  press the toolbar link button, the URL field has focus, so the first letter
  you type lands there ([#366](https://github.com/docs-plus/docs.plus/issues/366)).

- Outline rows of one heading level now start their titles at the same place.
  A heading with no subheadings keeps an empty space where the fold arrow
  sits, so it no longer shifts left. This holds in the desktop outline and in
  the phone outline. The fold arrow now tells screen readers whether the
  section is open ([#373](https://github.com/docs-plus/docs.plus/issues/373)).
- **Clear formatting keeps headings, Block style and links.** It removes text
  styles only: bold, italic, underline, strike, inline code, highlight,
  superscript and subscript. With no selection it changes no text, and the
  next text you type is plain. Before, a caret in a heading turned the heading
  into normal text, so its section, outline row and chat went away. The button
  is off when there is nothing to clear. `⌘\` (`Ctrl+\` on Windows and Linux)
  runs it too. The chat composer has the same control at the end of its
  format bar ([#392](https://github.com/docs-plus/docs.plus/issues/392)).
- The bell now counts account-wide alerts, such as a failed email delivery, in
  every document. The count updates live when one arrives.
- On a phone, Undo and Redo are disabled when there is nothing to undo or redo.
- **Contact support** on the sign-in error page sends an email to the published
  contact address. It used to open a public document named "support".
- On a phone, Back after View in the bookmark or notification sheet takes one
  press. It used to take two.
- Enter that confirms an input-method (IME) candidate no longer saves a
  half-typed rename.
- An empty heading in the outline has a name for screen readers, such as
  "Heading 2".

- Two plain paragraphs sit 0.25em apart, so short lines under a heading read as
  one block. Headings, subtitle, lists, tables, code and quotes keep the 0.75em
  gap.

- Headings of the same level in one section always share one size. Before, a
  section move, a new heading, a paste, undo or a remote edit could drop the
  size. The heading then fell back to a fixed default.
- Heading sizes run from 24pt to 14pt, and the document title takes no rank.
  Six levels in one section sit 2pt apart. The smallest heading is 14pt, so a
  short label heading no longer looks like 12pt body text.

- A heading inside a quote or a table now uses the same 24pt to 14pt range.
  Before, a small one there could look smaller than body text ([#369](https://github.com/docs-plus/docs.plus/issues/369)).
- Backspace or Delete on an empty line between two lists of the same type
  joins them into one list. A nested Delete no longer moves the empty line into
  a list item. Lists of different types lose the line but stay apart.

- The share card copies the clean document link. It used to copy the address
  bar, so heading, chat and filter parameters went out with the link.
- The share card says "Anyone with the link can edit" unless the document is
  Read-only. It used to say "view" for every public document.
- Share links encode the document URL, so a Facebook, X, LinkedIn, Reddit or
  Email link keeps the whole address. Links that open a new tab now say so to
  screen readers.
- Screen readers hear "Link copied" in the share card. The card body scrolls at
  400% zoom, so no share link is cut off.

- A chat notification from another pad opens that pad at the message.
- Signed-in REST replies never enter the service worker cache.
- Title and description saves made offline queue, then replay in order.
- The Share, Make private and Sign out dialogs have accessible names.

- `_chat-editor.scss` drops its unlayered `touch-action: manipulation` rule on
  `.composer-bar__actions .btn`. It overrode the mic's layered `touch-none`.

- The typing keyframe never ran. `.animate-badge-entry` came after
  `.avatar-typing` with the same specificity, so it won `animation`. A combined
  rule now plays both.

- `useChannelMessages` set `newestSeqRef` to null for an empty first window.
  The realtime drain reads null as "not loaded", so the first echo never
  merged. An empty first window now sets 0.

- `useJumpTo` waits until the new window lands. A send far from the tail
  appended into the old window, and the landing dropped the optimistic row.

- The desktop composer skeleton matches the loaded composer's geometry. A
  channel load error renders no composer and no skeleton.

- The composer input has no positive `tabindex`. Inline code and the mobile
  format grid show their active state.

- The composer link dialog opens and closes on the dialog motion tokens
  (`MOTION_DIALOG_IN_MS` / `MOTION_DIALOG_OUT_MS`).

- An ownerless Pad title stays editable after the metadata fetch. A missing
  or empty `ownerId` is open. The control waits for `documentId` so a
  pre-sync row does not flash as editable.

- A live chat notice used to say "someone" because a realtime INSERT has
  no users join. The chip now uses the snapshot username until that join
  is present.

- A refused history watch no longer strands compare mode or the URL. A
  refused compare watch with no base leaves compare mode. A refused view
  watch points `#history?version=` back at the version the editor shows.

- A composer that mounts in comment mode loads the saved draft. Before, it
  skipped the load, and the comment send then deleted the draft. Draft tiles
  now hydrate in comment mode, but comment files never enter the saved
  draft. `useComposerAttachmentDraft` splits `skipDraft` into `skipHydrate`
  and `skipWrite`. A send reads the live mode after the storage probe, so an
  edit or comment started during the probe keeps the editor.

- A send with files calls `releaseSentAttachments` on the active attachment
  list before its first `await`. Before, a reply, comment or edit that ended
  during the storage probe deleted uploads the send still named. The message
  was then refused or showed a broken tile. Escape during an edit send did
  the same through `cancelEditAttachments`. A failed probe or a failed edit
  returns the files to the list they left.

- The mic hold listeners in `ComposerPrimaryAction` follow the pressing
  pointer only, so a second finger no longer moves or ends the hold.
  `recorder.onstop` clears the timers and live levels, so a recorder that
  stops on its own leaks nothing. A first microphone denial after an early
  release now shows the error toast.

- A chat sash drag in `useResizeContainer` starts from `offsetHeight`, not
  `clientHeight`, so a click no longer shrinks the panel by its 1px
  `border-t`.

- The hover ⋯ menu Copy link is a `<button type="button">`. The `<a>` had no
  `href`, so it had no button role and no keyboard activation.

- `MobilePadTitle` and `DocumentSettingsPanel` send `slug` with their
  `useUpdateDocMetadata` saves, as `DocTitle` already did. A first save on a
  never-persisted draft then creates the row under the URL slug, not under
  `slugify(title)`.

- The `Highlight` extension declares a `color` attribute. It parses
  `data-color` or the inline background colour, and renders both. Upstream
  adds `color` only with `multicolor` on, so a stored highlight lost its
  colour.

- A visitor who pastes or uploads media, imports or exports sees the sign-in
  dialog. It used to send the request, which failed.
- Heading faces in the outline no longer go blank after someone leaves.
- The header face count leaves out people who left.
- Remote carets set their color and avatar through checked values. An avatar
  loads only from the profile storage bucket or a Google profile host.

- Chat closes when you switch to another document. It used to stay open and
  show the old document's room.
- On a phone, Back after a document switch with chat open takes one press. It
  used to take two.
- On a wide screen, small dropdowns, such as the documents sort, are 32px
  tall. The small size was never built, so they showed at full size.
- Grid previews in Settings → Documents keep their 4:3 shape. A long first
  page no longer stretches the band.
- In a segmented control, such as the list and grid toggle, the selected
  segment shows its whole border.

- **Push recovers on a signed-in load.** `refreshSubscriptionIfNeeded` saves
  the subscription again at most once a day and never unsubscribes a working
  subscription. It restores a missing subscription when push was on for this
  device, so a subscription the browser replaced is saved at once. It
  subscribes again when the VAPID key changed. The old refresh
  ran every 30 days and unsubscribed first, so it could break a working
  subscription
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **Sign-out unregisters this device's push subscription first.**
  `useSignOut` calls `unregisterPushSubscription` before `signOut()` when
  notification permission is granted, because the RPC needs a live session. The next person on this browser no longer
  gets the old account's pushes
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **Every push shows a notification.** A bad or empty payload still shows a
  generic notification, because Chrome can revoke a subscription that shows
  nothing. Every server type has a title,
  `content_change` and `system_alert` included
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).

### Security

- **A heading chat belongs to its own document.** The chat opens the channel
  row that holds this document and this heading, never a row found by id
  alone. So a copy of a document starts with empty heading chats, and a row
  that another document made never opens here. A chat link opens a channel of
  this document, or a heading of this document, and nothing else. A new
  channel takes a server id, not the heading's toc-id. Old chats keep their
  history, links, unread badges and media
  ([#402](https://github.com/docs-plus/docs.plus/issues/402)).
- **A highlight colour is a hex or numeric `rgb()` value, or nothing.**
  `Highlight` checks `color` on parse and on render, because stored marks and
  Yjs updates skip parse. Document content can no longer add CSS to the page
  ([#399](https://github.com/docs-plus/docs.plus/issues/399)).
- **`docTitle` is a refetch signal.** The relay has no access check, so the
  signal carries no text. `useYdocAndProvider` routes it to
  `onDocTitleStateless` in `utils/titleWrite.ts`, which fetches the title over
  REST. One fetch runs at a time, with a 2 s gap before a rerun
  ([#406](https://github.com/docs-plus/docs.plus/issues/406)).
- **The sign-in error page never shows text from the URL.** `proxy.ts`
  forwards `error_code` only. `/auth/error` shows fixed copy: one message for
  `otp_expired`, and one for every other code
  ([#411](https://github.com/docs-plus/docs.plus/issues/411)).
- **A notification click opens same-origin URLs only.** The service worker
  opens `/` for any other `action_url`
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- **Document page props carry no access token.** `documentServerSideProps`
  sends `isAuthed` in its place, and the WS `token` callback reads
  `getSession()` only. The service worker caches page props, and its header
  rule cannot see a token in a body
  ([#429](https://github.com/docs-plus/docs.plus/issues/429)).
- **Sign-out clears chat drafts and the old document keys.** Once
  `signOut()` leaves no session, `useSignOut` awaits `clearAllComposerDrafts()`.
  It cancels queued draft writes first, so the pagehide flush cannot write one
  back. Sign-out also removes the unused `docId`, `padName`, `slug` and
  `title` keys, and `useDocumentMetadata` is deleted
  ([#444](https://github.com/docs-plus/docs.plus/issues/444)).
- **A live chat message takes its author's avatar from the profile, not from
  presence.** Any client can send a presence payload. A forged one could change
  the avatar on another user's live messages, and the name and avatar in the
  media gallery. Both now read the profile. One request serves every
  message by that author
  ([#428](https://github.com/docs-plus/docs.plus/issues/428)).
- **A paste or a channel row can no longer crash a document page.** Pasted
  HTML never creates an upload placeholder, and an unknown file type shows the
  image icon. The heading unread sync no longer builds a selector from a
  channel row ([#436](https://github.com/docs-plus/docs.plus/issues/436)).
- **A new document link comes from a cryptographic random source.** `/new`,
  the `new.` host, the home page and shared files make an 11-character link
  that nobody can predict and claim first
  ([#442](https://github.com/docs-plus/docs.plus/issues/442)).
- **New profile photos cannot be SVG.** The `user_avatars` and
  `channel_avatars` buckets accept JPEG, PNG, GIF and WebP only. Settings
  converts other images, or shows an error
  ([#431](https://github.com/docs-plus/docs.plus/issues/431)).
- **The profile read no longer asks for online status or last-active time.**
  The status heartbeat still writes `status` and does not read it back.
  Deploy this at least 24 hours before the Supabase migration. Otherwise, an
  older open tab fails to sign in
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)).

### Removed

- Next routes for Validate, Status, and Confirm. The service worker no longer
  writes user status.

- `latestSnapshot` on the `history.list` wire type, and `latestSnapshot` /
  `setLatestSnapshot` in the history store. A failed watch no longer tries to
  hydrate from it. The list carries no document bytes.

- `useJumpTo` jumps to the present only. `JumpTarget` and the `jumpTo` field
  on `ChatroomContextValue` are gone. `snapToPresent` is the one caller.

- Five `window.__chatTestApi` hooks that no spec used: `currentTailSeq`,
  `lastSeenSeq`, `jumpToPresent`, `revealFeedSpoiler` and
  `isFeedSpoilerRevealed`.

- The "No more notifications" and "No more bookmarks" lines at the end of
  each list.

### Internal

- Add `uqr` and `components/ui/QrCode.tsx`. The QR ink uses three fixed
  tokens, `--qr-plate`, `--qr-ink` and `--qr-eye`, in every theme.
  `PresentQrCode.tsx` owns the Present `<dialog>`, full screen and focus
  return. `documentSettingsOpenRequest` opens the toolbar Document settings
  popover from the share card.

- Tab close holds the JWT in a ref and PATCHes `users` with keepalive.

- Chat stores and broadcast payloads have real types, not `any`. The unused
  typing map, the dead pin listener, and dead composer code are gone. The
  composer `ToolbarButton` takes a plain `isActive`. `SignInToJoinChannel`,
  the `setWorkspaceSetting` and `clearMemoryStates` store setters, and the
  unused `workspaceId` and `workspaceBroadcaster` fields are gone too.
  `ChatMediaUploadRunner` no longer appends a missing row, because `addFiles`
  creates each row first. `ChatList` drops its unused `channelId` prop and its
  `as any` casts.

- The desktop emoji picker no longer re-renders on every chat store change.

- The chat agent docs and the design system match the code again.

- A failed service-worker update check is no longer reported. The current
  worker stays in control, and the next check retries.

- `Select` drops its `color` prop and the `SelectColor` type.
  `selectSizeClassName` maps each size to a literal class, and
  `SearchableSelect` uses it too.

- `destroyChatRoomForHistory` is now `closeOpenChatRoom`. `DocumentPage`
  calls it on a document switch. `TabbedPanelBody` drops `endMessage`.

- `BottomSheet` mounts into the `mountPoint` its sheet data names, and holds
  it through the close tween. A registry entry can set `escapeKey: false`.
  The phone Documents ⋮ is the `documentRowMenu` sheet.

- Documents list cache writes reach every list of the user: each scope,
  search and sort.

## [2.0.1] — 2026-08-31

This package shared `2.0.1` with hocuspocus. The product notes are in the
[root CHANGELOG](../../CHANGELOG.md#201--2026-08-31).
