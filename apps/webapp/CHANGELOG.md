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
  card shows the MCP mark, a live status (Online, Unreachable, or You're
  offline), a **Setup guide** link, and one row of chips for what a
  connected AI app may do (read, create, edit and chat). The status only
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
  homepage; `privacy`, `terms`, `oauth` and `c` are reserved slugs now, like
  `editor` and `new`.
- A primary `CopyButton` turns green when the copy succeeds. Before, it put
  green text on a blue button.
- **A transparent 96 px site icon.** Claude draws a connector's icon from
  Google's favicon service, on a dark tile. The opaque white icons showed
  there as a white square. `icon-96x96.png` is the logo with no background,
  and the page links it. `icon-192x192.png` is the same logo, kept as the
  file to upload in connector dialogs. Google refreshes its copy only after
  it crawls docs.plus again.
- **Settings › Security shows how you sign in and which apps have access.**
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
- **Home shows recent documents and an Install app button.** A signed-in
  owner sees up to 8 documents by Last opened, with See all into Settings.
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

- **Settings › Documents lists the documents you joined.** One list shows
  the documents you own and the ones you opened while signed in. A **Show**
  menu beside the sort picks All documents, Owned by me or Joined, and the
  browser tab keeps your pick. A document you do not own shows its owner's
  name. Its ⋮ menu offers only Open in new tab and Copy link. Joined has its
  own empty state. Home and Command jump still list only your own documents.

### Changed

- **The heading chat button shows while the pointer is over its section.** On
  a desktop, the button shows anywhere over the heading and the blocks under
  it. A block under a nested heading shows only that heading's button. The
  button leaves when the pointer leaves the section or the document sheet
  (#372).
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
  browser's own menu (#391).

- **An empty line's hint now shows only its heading chain.** It no longer ends
  with ` > Write here`. Every pad hint and the Title hint use one grey, a little
  darker than before. That grey passes 4.5:1 contrast in every theme. The chat
  composer hint does not change.

- **Home lists the same documents as Settings → Documents.** The Home card
  shows pads you own and pads you joined, in one list. It has the Show and
  sort pickers, avatars, the ⋮ menu, Date groups, and Delete with Undo. Home
  and Settings keep the same picks. The card shows the first 8 rows and See
  all. On a phone, Rename opens a dialog.

- **Settings › Documents shows Trash only when the trash holds a document.**
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

- The share card is wider and puts the QR code on the left. On hover, a light
  blur and a fullscreen button cover the code. At rest nothing covers it, so
  it always scans. The card no longer shows the document name. The footer line
  says what anyone with the link can do, and the owner sees Change.

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
  sent back. Both come from upstream bugs (`@tiptap/y-tiptap` #55 and
  `@hocuspocus/provider` 3.x).

- On a phone, the Settings › Documents ⋮ menu opens the app's standard
  bottom sheet. Settings stays open behind it.
- Chat toolbar buttons show the app's tooltip. The close button reads
  "Close chat".
- A document with 4 members shows all 4 faces. Past 4, the row shows 3 faces
  and the count of the rest.

### Fixed

- Outline rows of one heading level now start their titles at the same place.
  A heading with no subheadings keeps an empty space where the fold arrow
  sits, so it no longer shifts left. This holds in the desktop outline and in
  the phone outline. The fold arrow now tells screen readers whether the
  section is open (#373).
- **Clear formatting keeps headings, Block style and links.** It removes text
  styles only: bold, italic, underline, strike, inline code, highlight,
  superscript and subscript. With no selection it changes no text, and the
  next text you type is plain. Before, a caret in a heading turned the heading
  into normal text, so its section, outline row and chat went away. The button
  is off when there is nothing to clear. `⌘\` (`Ctrl+\` on Windows and Linux)
  runs it too. The chat composer has the same control at the end of its
  format bar (#392).
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

- Headings of the same level in one section always share one size. A section
  move, a new heading, a paste, undo or a remote edit used to drop the size, so
  the heading fell back to a fixed default.
- Heading sizes run from 24pt to 14pt, and the document title takes no rank.
  Six levels in one section sit 2pt apart. The smallest heading is 14pt, so a
  short label heading no longer looks like 12pt body text.

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
- Grid previews in Settings › Documents keep their 4:3 shape. A long first
  page no longer stretches the band.
- In a segmented control, such as the list and grid toggle, the selected
  segment shows its whole border.

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
