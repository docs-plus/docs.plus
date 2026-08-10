# CLAUDE.md — `extensions/*`

Extension development, per-package rules, and the webapp-side popover integration.

Moved verbatim out of the repo-root [AGENTS.md](../AGENTS.md) so it loads only when working here. Root-level rules (git policy, package manager, code quality, test policy) still live there and still apply.

## Extension Workflow

### Standalone Extension Development

- Standalone packages: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`, `extension-placeholder`.
- Shared structure: TypeScript + tsup build + `@tiptap/core` peer dep.
- **A MARK's `renderMarkdown` cannot transform its own label.** `@tiptap/markdown` calls the handler with a synthetic node whose content is a sentinel placeholder. It then keeps only the slices _before_ and _after_ that placeholder (`getMarkOpening` / `getMarkClosing`). So `helpers.renderChildren(node)` returns the sentinel, not the text. Any `.replace()` chained onto it is dead code. If it ever altered the sentinel, `indexOf` returns `-1` and the mark renders as an **empty string**, silently deleting the syntax. Wrap only: `` `${helpers.renderChildren(node)}` `` (extension-inline-code) is correct; escaping or encoding the label from here is not. Attribute-side work — the link's own href, which the hyperlink mark percent-encodes — is fine, because it lands in the closing slice. A hyperlink `]`-escape sat dead in shipped code until 2026-08-08 with a CHANGELOG entry claiming it worked.
- GFM markdown uses `@tiptap/markdown`; paste lives at `apps/webapp/src/components/TipTap/extensions/markdown-paste/`; import/export conversion lives in `apps/hocuspocus.server/src/modules/document-conversion/domain/` (`markdownImport.ts`, `markdownExport.ts`, plus DOCX/ODT export), wired to the UI through `toolbar/desktop/DocumentSettingsPanel` → `ImportExportSection.tsx`.
- `sanitizeJsonContent` runs on paste and import paths.
- After modifying any `extensions/extension-*` source:
  1. Run `bunx tsup` in that package.
  2. Clear `.next/cache` or remove `.next`.
  3. Restart the dev server and hard-refresh the browser.
- Next.js HMR does not reliably detect changes in Bun workspace-symlinked packages.
- If an extension playground is running via `bun run playground` (`bun --hot docs-playground`), restart it after `bun run build`. The tsup `clean: true` setting can wipe `dist/` and leave the hot server serving 500 for `dist/styles.css`.
- Import/export for hyperlink and every hypermultimedia kit node is not complete until clean-room Cypress covers both markdown **and** HTML round-trips (`getHTML()` → `setContent()`). The kit has nine nodes, including Spotify. The shared spec `cypress/e2e/serialization/html-round-trip.cy.ts` covers all kit nodes; when fixing one node's copy/paste, extend it for all kit nodes, not only the broken one. The HTML leg matters because `renderHTML` emits iframe widget URLs that each node must unwrap back to canonical page URLs (see §Hypermultimedia Extension).

### Hyperlink Extension

Extension-internal rules (schema, commands, click handling, safety/normalization, metadata/preview, the `specialUrls` catalog, public API surface, popover engine, clean-room Cypress harness) live in [`extensions/extension-hyperlink/AGENTS.md`](extension-hyperlink/AGENTS.md). Read that file before touching anything under `extensions/extension-hyperlink/src/`. The webapp-side popover integration is below.

### Webapp-Owned Hyperlink Popovers

- The extension stays host-agnostic. `popovers.createHyperlink` / `popovers.editHyperlink` are callbacks returning `HTMLElement | null`.
- Desktop create/edit entries create an empty host and set only `host.dataset.testid`. Never set `host.className`.
- Register `{ kind, host, props }` via `setActivePopover` in `hyperlinkPopoverStore.ts`.
- Return the host so the extension's floating controller positions it.
- A single React `<HyperlinkPopoverPortal>` reads the active popover via `useActivePopover` and portals `<HyperlinkEditor>` with `<HyperlinkSuggestions>` into the host. `DesktopEditor.tsx` mounts it; `pages/editor.tsx` mounts it for the standalone playground. Never mount a second `HyperlinkPopoverPortal` inside `MessageComposer` when `DesktopEditor` already mounts the page-level one.
- Tests select by `data-testid` only. Do not restore legacy class selectors.
- `hyperlinkPopoverStore.ts` subscribes once at module load to `getDefaultController().subscribe((state) => state.kind === 'idle')`.
- The idle discriminator is `idle`, not `closed`.
- The subscription is guarded by `globalThis.__hyperlinkControllerSubscribed` (`SUBSCRIPTION_FLAG`) so HMR/Jest module-cache replays do not stack listeners.
- Legacy `.hyperlink-create-popover` and `.hyperlink-edit-popover` SCSS blocks were removed from `styles/styles.scss`.
- Only `.hyperlink-preview-popover` keeps SCSS because preview is still rendered by imperative DOM.
- Create popover UX is minimal: one inline `[URL input] [Add]` row plus suggestions; no header and no Cancel.
- Edit popover keeps back arrow, URL/Text labels, and Update.
- Mobile `LinkEditorSheet` dismisses through drag/backdrop and also has no Cancel.
- Controls use DaisyUI: `input input-sm`, `input-error`, `btn btn-primary btn-sm`, `btn btn-ghost btn-sm btn-square`.
- Suggestions data:
  - headings from top-level `doc.content` children, same source as `useTocActions.copyLink`;
  - current-workspace bookmarks, both active and archived via parallel `getUserBookmarks` calls;
  - active bookmarks sort before archived.
- Suggestion URLs are absolute and reuse `useTocActions.copyLink` and `BookmarkItem.handleCopyUrl` shapes:
  - headings: `?h=...&id=<headingId>`;
  - bookmarks: `?msg_id=...&chatroom=...`.
- Picker command contract: choosing a heading/bookmark during create applies only `href` when text is selected. Choosing a suggestion during edit updates only URL unless the user explicitly edited the Text field.
- Suggestion states are collapsed -> browsing -> searching.
- Desktop default state is `collapsed`; mobile default state is `browsing`.
- Webapp icon catalog:
  - `hyperlinkPopovers/iconList.ts` was deleted.
  - `previewShared.ts::TYPE_TO_ICON` maps `SpecialUrlType` to Lucide icons from `Icons` (`@components/icons/registry`), typed `Partial<Record<SpecialUrlType, IconType>>` (`IconType` from `react-icons`).
  - It is intentionally partial so domain-catalog types such as `meet` or web `github` can be absent; favicon wins for `https://` URLs.
  - Use Lucide React components only.
  - `createSvgIcon(Icon)` renders with `renderToStaticMarkup(createElement(Icon, { size: 20, 'aria-hidden': true }))`.
  - Do not reintroduce per-platform `Fa*` / `Si*` icons or hard-coded SVG strings.

### Composer Link Dialog And Internal Links

- **Surface routing.** Pad desktop → `createHyperlinkDesktop` + the page-level `HyperlinkPopoverPortal` above; pad mobile → `createHyperlinkMobile` → `linkEditor` / `linkPreview` sheets via `useSheetStore` (see §Mobile Bottom Sheets And Overlays). The mobile **chat composer** is a separate surface. `getHyperlinkPopoverConfig(isMobile, surface)` with `HyperlinkSurface = 'pad' | 'composer'` routes `composerMobilePopoverEntries` (return `null`, open `composerLinkDialogStore`) and a portaled `ComposerLinkDialog` in `MobileLayout` — not the pad `linkEditor`.
- Composer `useTiptapEditor` uses `getHyperlinkPopoverConfigAtInvoke(() => isComposerMobileRef.current, () => 'composer')` so the frozen `useEditor([], …)` reads layout at invoke time (`variant === 'mobile'` via ref, not `settings.editor.isMobile`).
- Snapshot selection in `composerLinkSelectionRef` before modal focus steal (toolbar create + iOS save).
- All composer link dialog paths (preview tap on `<a>`, edit/add open, Cancel, dismiss) must preserve keyboard state — open stays open, closed stays closed. Never call the pad's `previewHyperlink.dismissSoftKeyboard`. Snapshot `keyboardWasOpenAtOpen` at open, and refocus on close only when the keyboard was open. Cancel must not collapse an open keyboard.
- `ComposerLinkModalShell` centers in the visual viewport on iOS and Android via `--visual-viewport-height` / `--visual-viewport-offset-top`, not `fixed inset-0` or top-clamped placement.
- The URL field is a `<textarea>` (not `<input>`) with Tailwind v4 `field-sizing-content` + `max-h-24`. Long URLs then auto-grow within the row instead of overflowing horizontally. Pad `HyperlinkEditor` and composer `ComposerLinkEditorDialog` share the shape. The daisyUI `.input` wrapper around the textarea owns the border/focus ring, because it has no built-in textarea styling. The popover shell is responsive (`min-w-[26rem]` floor, `max-w-[min(34rem,calc(100vw-2rem))]`), not a fixed `w-[24rem]`.
- **Internal document links (smart link popover).** One pure resolver `internalDocumentLink.ts` — `classifyInternalDocumentLink(href, pathname)` → `InternalDocumentLink | null` (union `document | heading | chat | filter | history`; `null` = external/another doc) + `describeInternalDocumentLink(link, editor)` → `{ label, icon }`. The side-effecting `runInternalDocumentLink` lives in sibling `internalDocumentLinkActions.ts` (PubSub/scroll/history), split from the resolver. `classify` then unit-tests (`internalDocumentLink.test.ts`) without dragging the `@utils/index` barrel → supabase graph, which throws in Jest without env. `navigateHref` (`hrefEventHandler.ts`) = classify → if internal `run()` (closes the popover uniformly first) → else `window.open`; the old inline per-dialect `if` ladder is deleted.
- Bookmark/notification links need no special kind. They already build canonical `?chatroom=&msg_id=`, so they resolve to `kind: 'chat'`. Cross-document docs.plus links stay external (exact doc-slug match, not `startsWith`). Internal links skip the metadata fetch/favicon entirely. The heading kind keys on `?id=` (the `?h=` breadcrumb is written/shared but never read for navigation).
- The internal-link chip renders two ways, mirroring the existing split: imperative `createInternalLinkChip` (desktop `previewShared.ts`/`previewHyperlink.ts`) + React `<InternalLinkChip>` (mobile `LinkPreviewSheet`/`linkPreviewActions`, composer `ComposerLinkPreviewDialog`). The primary action is "Go to destination"/"Go". Copy always yields the raw canonical href. Desktop chip SCSS (`.is-internal`) lives in `document-styles.scss` (token-based, light + dark).

### Hypermultimedia Extension

- When changing embed behavior **or toolbar host hooks**, update the per-node README and package README for end users in the same change. Embed behavior covers paste rules, oEmbed/iframe params, and node attrs. Toolbar host hooks cover `mediaActions`, `mediaToolbarIcons`, and the hover/open hot paths.
- Toolbar work is performance-critical: reuse via `existingToolbar` when possible. Otherwise use doc-cached `resolveMediaActions` + one DOM build per mount. Add no extra caching/indirection beyond that without measured hot-path justification.
- On multi-item embed work ("work on all of them"), honor explicit scope exclusions the user states. For example, skip toolbar/player-param UI for YouTube when they say "do not work on the toolbar". When the user scopes a task to **webapp-only**, leave publishable `extension-*` packages untouched. Wire icons/Comment/host behavior through existing kit hooks from the webapp. Do not "helpfully" refactor the extension until they ask.
- **The loading shell MUST always settle.** `.hm-media-slot` holds `opacity: 0` until `data-hm-loading` reaches `ready` or `error`, so a shell that never settles renders an **invisible player**, not merely a stuck spinner. Any new media node has to reach one of those states on every path, including the ones that fire no load event. A src-less element settles to `error`, repairable via Replace URL. `preload: 'none'` settles to `ready`, because the controls are all there is to paint. Assert **computed opacity**, never `should('exist')` — `exist` passes at `opacity: 0`, which is why `preload: 'none'` shipped invisible until 2026-08-08. Canonical: `extensions/extension-hypermultimedia/cypress/e2e/loading/preload-none.cy.ts`.
- Cypress resize/loading specs must assert rendered DOM size, not ProseMirror node attrs alone. Read the inline `style` width/height, or `getBoundingClientRect` on `img` / iframe / `.hm-media-host`. Attrs can commit while the node view still paints the old pixel box. Gripper-drag specs on iframe embeds: the loading shell keeps the slot at `opacity: 0` until load. Assert the iframe stays mounted with computed `display`/`visibility` not hidden, not Cypress `be.visible`.
- HTML copy/paste round-trips through `renderHTML` iframe widget URLs. Each embed node must unwrap widget URLs back to canonical page URLs in `src.parseHTML` and embed builders. SoundCloud was the missing `parseSoundCloudTrackUrl`; YouTube/Vimeo/Loom already normalize; X emits blockquote+anchor. Cover all kit nodes in `cypress/e2e/serialization/html-round-trip.cy.ts` (see §Standalone Extension Development).
- **SoundCloud:** the iframe UI does not scale with the loading shell `aspect-ratio`. Floor display height to the widget minimum (120px compact / 166px visual) via `syncSoundCloudResponsiveHost` and `fitSoundCloudLayoutToEditorColumn`. Gripper/resize min heights must read live SoundCloud extension options (`visual`), not kit defaults alone. Consolidate node-specific resize floors in one helper, not duplicated `if (soundcloud)` branches in shared decoration code.
- **X** leaf oEmbed: `omit_script=1`, single `widgets.js` via `whenTwttrReady`, seed blockquote+anchor on oEmbed failure, height watcher until node-view destroy, `overflow: visible` when ready, sanitizer `hrefHosts: ['x.com', 'twitter.com']`.
- **X-embed CSP — resolved (2026-07-07).** The full X path is allowlisted end-to-end and verified against the emitted header. Publish/syndication/platform hosts sit in `connect-src`. `platform.twitter.com`/`platform.x.com` sit in `script-src` and `frame-src` (plus syndication); widgets.js is the only third-party script the editor injects. Widget-internal media loads under X's own CSP, and parent-context images ride the `img-src https:` wildcard. Hosts live in the `X_*` groups of `apps/webapp/config/security/third-party-hosts.js`, spread into `next.config.js`. X embeds do not degrade to the seeded blockquote in production, and the blockquote fallback needs no grants. Future X endpoint changes are a one-line `X_*_HOSTS` edit plus a server restart.
- **Spotify** (the 9th kit node, `src/nodes/spotify/`) is fixed-height like SoundCloud. The player UI does not scale, so pin host height via `syncSpotifyResponsiveHost` + `fitSpotifyLayoutToEditorColumn` (fit width to column, keep height). `theme` is `0` dark / `1` light; `defaultSpotifyHeight` is 152px for `track`, 352px otherwise. `parseSpotifyEntity` accepts `open.spotify.com/{track,album,playlist,artist,show,episode}/{id}`, plus `intl-xx`, `embed/`, and `spotify:type:id` URIs. A `parseHTML` rule and a plain-text paste rule both accept the bare URL **and** the "Copy embed" `<iframe src*="open.spotify.com/embed">` markup. Both canonicalize `src` back to the share URL (drops `utm_source`/`si`).
- **Adding any new iframe-embed media node requires allowlisting its host in `IFRAME_EMBED_HOSTS` (`apps/webapp/config/security/third-party-hosts.js`)**. That list feeds CSP `frame-src` in `next.config.js`, so a missing host makes Next.js block the iframe. The symptom looks like "a Next.js error". `next.config.js` is read only at startup, so the dev server must restart to apply it. Webapp wiring is the `MEDIA_INSERT_REGISTRY` entry in `mediaPopovers/mediaInsert.ts` (`setSpotify`, `FaSpotify`, `unfurl: true`).
- **`isSafeMediaSrc` gates the write side, and not all of it.** `src/utils/mediaUrl.ts` runs on `parseHTML` for `video`, `audio`, `vimeo` and `youtube`, on markdown import, and in the Replace URL dialog. `src/commands/` has no call, so insert commands and collaborative sync store `src` ungated. Treat any value read back off a node as untrusted. Wire the gate into a new node's `parseHTML` when you add one. Markdown import and Replace URL pass `allowInlineImage: true`, which admits `data:image/*` (SVG excluded — it carries script). `DANGEROUS_SCHEME_RE` is a byte-identical twin of extension-hyperlink's; `scripts/extension-preflight.sh` diffs them and fails on drift. It fails **closed** — `assert_lockstep` exits on an empty extraction, so a renamed anchor is an error, not a silent pass. Both properties were fixed on 2026-08-09 and are worth keeping. The guard genuinely was fail-open before that: an empty `grep` made `diff` compare two empty streams and report "identical", which was negative-tested. It also never ran in CI at all. The cause was its `EXT_ONLY` scoping, which required both packages in scope while prod passes a single matrix entry per job. If either property regresses, that is a real finding, not a re-raise.
- **The read side carries a different allowlist on purpose.** `isOpenableSrc` (`toolbar/handlers.ts`) guards the `window.open` sink and permits `blob:`, which `isSafeMediaSrc` rejects. Keep the two separate. Folding the read side onto the storage gate breaks "View original" for blob sources. Folding the storage gate onto the read side widens what can be persisted into the document.
- Pad editor file uploads hit the hocuspocus doc-media endpoint — size cap, env pitfalls, and floor behavior live in §Hocuspocus Server.

### Indent Extension

- Keep pad `TipTap.tsx` and chat composer `useTiptapEditor` on the same `Indent.configure({ indentChars: '\t' })`, or widen both together.
- Literal indent/outdent is gated by `allowedIndentContexts`, an allowlist of `{ textblock, parent }` TipTap type-name pairs.
- Default literal indent contexts: paragraphs under `doc` and `blockquote`.
- `[]` disables literal indent.
- Tab / Shift-Tab order:
  1. sink/lift list (`listItem` / `taskItem` when schema supports it);
  2. table cell navigation when table extension exists;
  3. literal indent/outdent.
- Extension priority is 25 plus delegation.
- Other textblocks need explicit `allowedIndentContexts` rules.
- Cypress: webapp suite under `apps/webapp/cypress/e2e/editor/indent/` plus the package clean-room suite (see §Test Orchestration And Authoring for ports and the run order); Jest lives under `extensions/extension-indent`.
