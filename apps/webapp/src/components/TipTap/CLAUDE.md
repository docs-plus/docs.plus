# CLAUDE.md — editor (TipTap / ProseMirror)

Document model, heading schema, list keymap, HeadingScale, editor performance, and editor state.

Moved verbatim out of the repo-root [AGENTS.md](../../../../../AGENTS.md) so it loads only when working here. Root-level rules (git policy, package manager, code quality, test policy) still live there and still apply.

## Editor Architecture

### Document Model And Migrations

- Server-side `TiptapTransformer.toYdoc` / nested-to-flat migrations must use an extension set that covers every node/mark in stored docs.
- Include `TaskList` / `TaskItem` from `@tiptap/extension-list` aligned with the webapp. StarterKit alone is not enough.
- Missing node/mark types fail encode; they are not flattening issues.
- **`lib/migration-extensions.ts` is an encode/storage set, not a rendering one** — its `hyperlink` and `highlight` are attribute-only stubs with no `toDOM`. Never add `toDOM` there to fix a conversion export: nothing on the storage path serializes, and `document-conversion` already swaps the real extensions in for its own schemas.
- Batch migrations fail closed. Never overwrite stored Yjs bytes when transform/encode fails; keep prior bytes and surface the doc id.
- Run the migration CLI from `apps/hocuspocus.server` after root `bun install`:

```bash
bun run migrate:nested-to-flat
```

- Invoking the script path from an arbitrary cwd can break Bun resolution of `yjs` for `@hocuspocus/transformer`.
- **Settings Markdown replace writes natural picture size in the browser.** After `setContent`, `commitImportedImageSizes` loads unsized images and stamps `keyId` plus natural width and height. Do not call `fitLayoutToEditorColumn` at apply time. A load miss leaves attrs empty. The import JSON and a `PATCH` stay unsized. Markdown import never makes the server fetch pictures.
- **A whole-document replace keeps heading `toc-id`s with a tiered matcher** (`pickHeadingIds` in `carryHeadingIds.ts`, called from `applyImportedContent`; #474, ruled 2026-11-06). Heading chats, `?id=` links, folds and the digest pair by that id. Each tier runs over every top-level heading before the next one starts, and each old id goes at most once.
  - Paste does not use this matcher. It keeps ids through `pastedDuplicatePositions` in `pad-unique-id.ts` (see the paste bullet below).
  - Tier 1: level, text and parent path (the ancestor heading texts, by the `outlineOf` rule). Tier 2: level and text. Tier 3: text at any level.
  - Tier 4: a non-empty section text that appears exactly once on each side (a rename).
  - Tiers 1 to 3 skip empty headings and break a tie by section text, then document order. Never fuzzy-match titles.
  - An unmatched heading drops any id it came with, and `UniqueID` gives it a new one. The staged card names each heading whose chat holds messages and loses it (`headingIdPlan`); an empty room loses nothing, so it is not named (ruling 2026-11-06). Exported files carry no ids (parked).
  - The matcher never gives out the pad's documentId (`padIdOf(editor)`), at any tier. An old heading that wrongly holds it does not pass it on.
- **A paste or drag from the same pad keeps heading `toc-id`s** (`PadUniqueID` in `extensions/pad-unique-id/`; #700, ruled 2026-11-06). Copy and cut stamp `data-docsplus-pad` on the first element of the clipboard HTML.
  - A paste counts as same-pad only when a parsed element carries the mark with this pad's id. Text that spells the mark does not count.
  - An internal drop is same-pad through `view.dragging`. The kept slice is rebuilt with new node objects, so a drag-copy re-keys the copy and a drag-move keeps the id.
  - Only a free id is kept (`pastedDuplicatePositions`). The pad's documentId is reserved for every writer, because the pad-wide chat room uses it as its `heading_id` (`04-channels.sql:42`). Compare it exactly, with no case change.
  - The mark carries the raw documentId. The id is not a secret: "No endpoint is protected by id-unguessability" (`apps/hocuspocus.server/CLAUDE.md`). A hash was weighed and rejected (research 2026-11-06).

### Heading Schema

- Editor uses a flat heading schema: `heading block*`.
- Sections are decoration-based.
- `attrs['toc-id']` renders as `data-toc-id`.
- Section reorder is TOC-only via `components/toc/utils/tocMove.ts`: `planTreeMove` plans, and `treeMoveTransaction` deletes first, then inserts, in one transaction. There is no in-editor heading drag handle extension.
- **Concurrent moves (#510, CM1 and CM2, ruled 2026-11-06).** Yjs has no move, so two peers who move one set can each insert a copy.
  - `treeMoveTransaction` inserts the set unchanged, then shifts levels with `setNodeMarkup`. Never rebuild the headings before the insert: y-sync then re-creates them, and a peer's caret in a shifted heading jumps away.
  - `HeadingIdRepair` (`extensions/heading-id-repair/`) runs after a peer's change that alters the list of top-level heading ids. Every client first reports duplicate ids once (`collab:duplicate-heading-id`, counts only). Then a client that `isTocMoveLocked` does not lock repairs, after the first server sync.
  - Repair rule. Pass 1 (twin rule): a bare heading goes when the next block is an equal heading. Pass 2: the first copy in document order owns the id. A later set (heading plus body up to the next same-or-higher heading) that equals the first set goes. A different set keeps its content, and its heading takes a new id. That id is a hash of the copy's Yjs item id, so every peer writes the same value: 16 base62 chars, the shape of `stamp(16)`. Null ids never pair.
  - The repair writes the Y.XmlFragment directly, in one `ydoc.transact` with its own origin, so it lands on no undo stack. Never move it to a ProseMirror dispatch: when two peers repaired that way, a re-keyed copy appeared twice.
  - Hazards that stay. Typing in the shorter run of a concurrent move can be lost. R-3 can reorder a set that nobody moved. R-4 can leave a level that does not fit its parent. Undo after an R-5 race leaves `H1` headings with `toc-id` null. A co-editor still typing in an equal later copy right after the merge loses that typing, because it arrives after the repair deleted the copy (seen live; accepted, ruling 2026-11-06).
- Toolbar **Block style** (Title / Subtitle / H1–H6 / Normal) is outline role. Read and apply it through `TipTap/block-style/blockStyle`. Do not treat the H number as font size — that is HeadingScale. Names: [CONTEXT.md](../../../../../CONTEXT.md) §Pad outline.
- **Clear formatting never changes Block style** (#392). One command, `ClearFormatting` in `TipTap/clearFormatting.ts`, serves the pad toolbar, the mobile format drawer, the chat composer and `Mod-\`. It removes every mark except `hyperlink` and `link`, in one transaction. A collapsed caret changes no text. It sets the stored marks to the caret's link marks only, so the next typed text is plain and a link is not split. Never call `clearNodes`, `setNode` or `lift` from it: a demoted heading loses its section, TOC row and Heading chat. The disabled state is `editor.can().clearFormatting()`. A selection or caret that holds only a link counts as nothing to clear. The pad and the composer both load it next to `ListGapJoin`.

### List Keymap

- `ListKeymapWithoutTab` only drops `Tab` from upstream ListKeymap, because Indent owns Tab. Do not grow it into a second list behavior.
- `ListGapJoin` (`listGapJoin.ts`) is a temporary shim for #378. An empty paragraph between two lists goes away, and matching lists join through ProseMirror `autoJoin`. Lists match when they have the same node type and the same `type` attribute.
- It runs at priority 101, before ListKeymap, and binds the same keys that the core keymap sends to Backspace and Delete. It ties with upstream's branching Delete keymap at 101; their conditions do not overlap. The pad and the chat composer both load it, next to `ListKeymapWithoutTab`.
- Remove it when upstream `@tiptap/extension-list` re-joins lists across an empty paragraph.
- Never test list keys through `editor.commands.keyboardShortcut()`. Its transaction capture replays a second dispatch onto stale state, and throws `Inconsistent open depths`. Real keys never throw that error. Use real keys.

### HeadingScale

- `apps/webapp/src/components/TipTap/extensions/heading-scale/heading-scale.ts` is a mandatory spec.
- Heading font size is dynamic by rank within a section, not fixed per HTML level and not a Google-style ladder.
- The Title (the first top-level H1) takes no rank and gets no decoration. CSS draws it at a fixed 28pt.
- Range ruling, 2026-10-05 ([#369](https://github.com/docs-plus/docs.plus/issues/369)): keep the rank rule and set the range to 24pt down to 14pt. A 12pt heading looked like body text. The 28pt Title stays the largest line.
- Google Docs, Word and Notion give each level one fixed size. This rank rule is a recorded maintainer exception to that rule. Do not "fix" it.
- The headings after the Title, up to the next H1, form section 1. Each later H1 starts a new section.
- Ranking is per section, so the same level can have a different size in two sections.
- Within a section, distinct heading levels are sorted and sizes interpolate evenly between 24pt max and 14pt min. Body text is 12pt (16px), so the smallest heading is about 1.17x body text.
- The minimum step between neighbouring ranks is 2pt, at six ranks: 24, 22, 20, 18, 16, 14. The smallest neighbour ratio is then 16/14, about 1.14. Three ranks give 24, 19, 14. Two ranks give 24, 14.
- The same heading level repeated in one section gets the same visual size.
- A section with one distinct heading level uses 24pt.
- Use decorations only: `--hd-size`, `--hd-rank`, `--hd-total`. Never write sizes into the document.
- Plugin state is `{ fingerprint, decorations }`.
- Fingerprint is top-level heading levels in order, e.g. `1,2,4,1,3`.
- Map the decoration set while the fingerprint is unchanged. Rebuild fully when the fingerprint changes, or when mapping drops a decoration.
- Detect a drop with the `onRemove` option of `DecorationSet.map`. A step that replaces a heading's tokens drops its node decoration: `setNodeMarkup` (UniqueID writes `toc-id` this way), a TOC move, a Yjs block replace, split, join and paste.
- A Yjs change (remote, undo, redo) replaces only the changed top-level blocks (`@tiptap/y-tiptap` 3.0.10, #520). Mapping then drops only the decorations in that span, and a drop rebuilds the set. A full-document replace is y-tiptap's fallback path, and it drops every decoration. One full rebuild cost ~8.7 ms at 1501 headings (measured on y-tiptap 3.0.9, where every remote transaction replaced the whole document).
- Do not gate on a y-sync key string. PluginKey adds a numeric suffix (`y-sync$1` in the live app), so the old `getMeta('y-sync$')` check never matched. HeadingFold and HeadingFilter use the same `onRemove` rebuild since 2026-11-05.
- Do not replace this with fixed per-level point maps.
- A heading that is not top-level (inside a blockquote or a table cell) gets no rank decoration. It falls back to a fixed size by HTML level in `_heading-node.scss`: 24, 22, 20, 18, 16 and 14pt for h1 to h6, the same range as the scale. Keep those fallbacks in step with the range.

### Editor Performance

- Editor jank is usually React/Zustand re-renders, not ProseMirror.
- Never put UI flags in `useEditor` deps.
- Use `shouldRerenderOnTransaction: false` on collaboration editors.
- Decoration plugins should avoid full rebuilds on every keystroke. Use `transactionAffectsNodeType(tr, 'heading')` or a cheaper structural check.
- HeadingScale gates on a heading-level fingerprint, not `transactionAffectsNodeType`. Typing inside a heading maps the set.
- Link icons use a mark view, not a `DecorationSet`.
- **Each pad editor gets its own `Marked` (#781).** `TipTap.tsx` passes `Markdown.configure({ marked: new Marked() })`. `@tiptap/markdown` 3.32.2 otherwise registers every editor's tokenizers on the shared module-level `marked` and never removes them, so each closed pad's `Doc`, provider and IndexedDB mirror stayed live (21 after 20 switches; 2 with the fix). Never load `Markdown` unconfigured in an editor that is created and destroyed. Keep `marked` in the catalog at the version `@tiptap/markdown` resolves. A render-scope variable in a component with a stable `useCallback` can pin an old editor the same way: read the store at call time (`CommandJump.tsx`).
- Placeholder uses `@docs.plus/extension-placeholder` with O(1) state `init/apply`. Do not replace it with Tiptap's built-in placeholder, which scans with `doc.descendants`.
- **The pad loads its own `CodeBlockLowlight`** from `extensions/code-block-lowlight.ts` (#631). It copies the upstream lowlight plugin and skips `mermaid` blocks in the trigger and the walk. Upstream re-highlights every code block whenever the caret is in any code block, diagrams included. Diff the copy against the upstream lowlight plugin of `@tiptap/extension-code-block-lowlight` on every Tiptap bump. Do not switch back to the package import, and do not restore the `mermaid` stub language.
- **Foreign attribute mutations inside the editor recreate node views (media embeds reload).** ProseMirror's `DOMObserver` watches every attribute on every descendant (no `attributeFilter`). It reconciles non-PM mutations by re-rendering the dirty range, destroying+recreating the affected node views. `NODE_DIRTY` is set by `docView.markDirty` over the unioned range. `CustomNodeViewDesc.update` returns `false` before consulting `spec.update`, so a node-view's own `ignoreMutation`/`update` can NOT veto a range-set dirty. Sibling mutations recreate it as collateral. Consequences and wiring:
  - **Never render a persistent `[role="status"]` / `[aria-live]` / `output` ARIA live-region inside `.ProseMirror`.** `@floating-ui/react` `FloatingFocusManager.markOthers()` runs on every popover/dialog open, regardless of `modal`. It sets the `data-floating-ui-inert` marker even when no `inert`/`aria-hidden` is applied. It collects live-regions as keep-targets, recurses into the editor, and stamps `data-floating-ui-inert` across the whole doc → every iframe embed reloads. Use `aria-busy` or a live-region OUTSIDE the editor.
  - **Leaf/atom node-views must not expose `contentDOM`** — PM treats it as an editable content hole and re-parses async iframe/widget mutations.
  - Fixes in place: `extension-hypermultimedia/src/loading/defaultShell.ts` dropped role=status/aria-live, and the iframe embeds are leaf node-views (no `contentDOM`, like `x`/`video`/`audio`). Webapp `PopoverInsideElementsProvider` (exported from `@components/ui/Popover`, supplied once at `DesktopLayout` as `() => [editor.view.dom]`) keeps the editor inside `markOthers` for every `ui/Popover`. `ui/Popover` is non-modal, so excluding the editor costs no a11y (it only drops the cosmetic marker).
  - `DropdownMenu` (`@components/ui/DropdownMenu`, the click-menu host) takes a second path. It passes every `.ProseMirror` root, pad and composer, as `getInsideElements`. `ui/Popover`'s provider passes only the pad editor. `ToolbarSelect` and the chat hover dropdown use the `DropdownMenu` path. This is allowed only because the menu is non-modal.
  - `Dialog` / `ContextMenu`, and the trapped `BottomSheet` and `ModalDrawer`, are MODAL focus traps (their `FloatingFocusManager` defaults `modal=true`). Excluding the editor from THEIR `markOthers` would also drop its `aria-hidden`/`inert` behind the modal, which is an a11y regression. They deliberately rely on the no-editor-internal-live-region invariant instead (audited clean; do NOT add `getInsideElements` to modal surfaces).
  - Related latent footgun: `syncHeadingWidgetUnread` writes `dataset`/`style` to `.ha-chat-btn` every unread tick. That is safe ONLY because those are `Decoration.widget` DOM (DOMObserver ignores widget attribute mutations). Keep them widget DOM, never a schema node / NodeView content child.

### Editor State And References

- **Store discipline.** All `useStore` calls must use leaf selectors; never select `(state) => state` or `(state) => state.settings`.
- **Canonical editor handle:**

```ts
useStore((state) => state.settings.editor.instance)
```

- Registered by `useEditorAndProvider.ts` via `setWorkspaceEditorSetting('instance', editor)`.
- `window._editor` and `window._store` are set only by `pages/editor.tsx` (standalone playground); both are undefined on real document/collab routes. Do not add new `window._editor` readers to document-route features.
- React mobile sheets that need an editor reference use typed `SheetDataMap` payloads (e.g. `linkPreview`, `linkEditor`), not globals.
- **ProseMirror state pitfalls:**
  - `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
  - `transaction.before` is the pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
  - For fold-driven UI such as TOC, snapshot heading-fold plugin state from `editor.state` and diff across transactions.
- **Plugin view state lives in `view()`, never in the plugin factory.** Tiptap's `unmount()` and `mount()` build a new view from the same plugin and state, and the pad does this on load. A flag, timer map or previous-state snapshot at factory scope is shared by every view.
  - A shared `destroyed` flag stuck every heading fold in `animating`, so no fold opened again (fixed 2026-11-07). `heading-fold-plugin.test.ts` pins it.
  - A new view seeds its snapshot from the current plugin state. It re-arms any timer the old view's `destroy()` cleared.
  - `heading-filter-plugin.ts` still keeps its snapshot at factory scope and resets it in `destroy()`. Move it into `view()` when you next change that file.
- **Link Edit and Remove use two targeting rules (#678 Decision 3).** Desktop Remove acts on the selection, which y-tiptap restores through a co-editor's change. Edit cannot rely on the selection, because it need not sit on the link when the form opens. A click keeps a selection that overlaps the link, even one that starts before it. A mouse-opened preview leaves focus in the editor, and nothing closes it when the caret moves. So `buildEditRequest` re-reads the live `<a>` at Apply (`buildPreviewOptionsFromAnchor`), and `expectedHref` still guards it. Known gaps: the phone Edit path (`linkPreviewActions.tsx`) still uses the stored `nodePos`, and desktop Remove keeps the selection risk.
- **Indent lockstep.** Pad `TipTap.tsx` and the chat composer `useTiptapEditor` must stay on the same `Indent.configure({ indentChars: '\t' })` — widen both or neither. The full rule and the Tab/Shift-Tab order live in [extensions/CLAUDE.md](../../../../../extensions/CLAUDE.md) §Indent Extension, which does not load here.
