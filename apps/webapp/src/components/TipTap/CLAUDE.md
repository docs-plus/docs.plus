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
- **Settings Markdown replace writes natural picture size in the browser.** After `setContent`, `commitImportedImageSizes` loads unsized images and stamps `keyId` plus natural width and height. Do not call `fitLayoutToEditorColumn` at apply time. A load miss leaves attrs empty. The import JSON and a `PATCH` stay unsized. The server never fetches pictures.

### Heading Schema

- Editor uses a flat heading schema: `heading block*`.
- Sections are decoration-based.
- `attrs['toc-id']` renders as `data-toc-id`.
- Shared heading utilities live in `TipTap/extensions/shared/`: `computeSection`, `moveSection`, `canMapDecorations`, `transactionAffectsNodeType`, `matchSections`.
- Section reorder is TOC-only via `useTocDrag` / `moveHeading` + `moveSection`. There is no in-editor heading drag handle extension.
- Toolbar **Block style** (Title / Subtitle / H1–H6 / Normal) is outline role. Read and apply it through `TipTap/block-style/blockStyle`. Do not treat the H number as font size — that is HeadingScale. Names: [CONTEXT.md](../../../../../CONTEXT.md) §Pad outline.

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
- The headings after the Title, up to the next H1, form section 1. Each later H1 starts a new section.
- Ranking is per section, so the same level can have a different size in two sections.
- Within a section, distinct heading levels are sorted and sizes interpolate evenly between 22pt max and 12pt min. Body text is 12pt (16px).
- The minimum step between neighbouring ranks is 2pt, at six ranks: 22, 20, 18, 16, 14, 12. Three ranks give 22, 17, 12. Two ranks give 22, 12.
- The same heading level repeated in one section gets the same visual size.
- A section with one distinct heading level uses 22pt.
- Use decorations only: `--hd-size`, `--hd-rank`, `--hd-total`. Never write sizes into the document.
- Plugin state is `{ fingerprint, decorations }`.
- Fingerprint is top-level heading levels in order, e.g. `1,2,4,1,3`.
- Map the decoration set while the fingerprint is unchanged. Rebuild fully when the fingerprint changes, or when mapping drops a decoration.
- Detect a drop with the `onRemove` option of `DecorationSet.map`. A step that replaces a heading's tokens drops its node decoration: `setNodeMarkup` (UniqueID writes `toc-id` this way), `moveSection`, split, join and paste.
- A Yjs change (remote, undo, redo) replaces the whole document, so mapping drops every decoration and the set rebuilds. A peer pays one full rebuild per remote transaction (measured ~8.7 ms at 1501 headings).
- Do not gate on a y-sync key string. PluginKey adds a numeric suffix (`y-sync$1` in the live app), so the old `getMeta('y-sync$')` check never matched.
- Do not replace this with fixed per-level point maps.

### Editor Performance

- Editor jank is usually React/Zustand re-renders, not ProseMirror.
- Never put UI flags in `useEditor` deps.
- Use `shouldRerenderOnTransaction: false` on collaboration editors.
- Decoration plugins should avoid full rebuilds on every keystroke. Use `transactionAffectsNodeType(tr, 'heading')` or a cheaper structural check.
- HeadingScale gates on a heading-level fingerprint, not `transactionAffectsNodeType`. Typing inside a heading maps the set.
- Placeholder uses `@docs.plus/extension-placeholder` with O(1) state `init/apply`. Do not replace it with Tiptap's built-in placeholder, which scans with `doc.descendants`.
- **Foreign attribute mutations inside the editor recreate node views (media embeds reload).** ProseMirror's `DOMObserver` watches every attribute on every descendant (no `attributeFilter`). It reconciles non-PM mutations by re-rendering the dirty range, destroying+recreating the affected node views. `NODE_DIRTY` is set by `docView.markDirty` over the unioned range. `CustomNodeViewDesc.update` returns `false` before consulting `spec.update`, so a node-view's own `ignoreMutation`/`update` can NOT veto a range-set dirty. Sibling mutations recreate it as collateral. Consequences and wiring:
  - **Never render a persistent `[role="status"]` / `[aria-live]` / `output` ARIA live-region inside `.ProseMirror`.** `@floating-ui/react` `FloatingFocusManager.markOthers()` runs on every popover/dialog open, regardless of `modal`. It sets the `data-floating-ui-inert` marker even when no `inert`/`aria-hidden` is applied. It collects live-regions as keep-targets, recurses into the editor, and stamps `data-floating-ui-inert` across the whole doc → every iframe embed reloads. Use `aria-busy` or a live-region OUTSIDE the editor.
  - **Leaf/atom node-views must not expose `contentDOM`** — PM treats it as an editable content hole and re-parses async iframe/widget mutations.
  - Fixes in place: `extension-hypermultimedia/src/loading/defaultShell.ts` dropped role=status/aria-live, and the iframe embeds are leaf node-views (no `contentDOM`, like `x`/`video`/`audio`). Webapp `PopoverInsideElementsProvider` (exported from `@components/ui/Popover`, supplied once at `DesktopLayout` as `() => [editor.view.dom]`) keeps the editor inside `markOthers` for every `ui/Popover`. `ui/Popover` is non-modal, so excluding the editor costs no a11y (it only drops the cosmetic marker).
  - `Dialog` / `ContextMenu`, and the trapped `BottomSheet` and `ModalDrawer`, are MODAL focus traps (their `FloatingFocusManager` defaults `modal=true`). Excluding the editor from THEIR `markOthers` would also drop its `aria-hidden`/`inert` behind the modal, which is an a11y regression. They deliberately rely on the no-editor-internal-live-region invariant instead (audited clean; do NOT add `getInsideElements` to modal surfaces).
  - Related latent footgun: `syncHeadingWidgetUnread` writes `dataset`/`style` to `.ha-chat-btn` every unread tick. That is safe ONLY because those are `Decoration.widget` DOM (DOMObserver ignores widget attribute mutations). Keep them widget DOM, never a schema node / NodeView content child.

### Editor State And References

- **Store discipline.** `useStore` (the main app store in `stores/useStore.ts`) combines six slices: `workspaceStore`, `usersPresence`, `history`, `notification`, `virtualKeyboardStore`, `dialogStore`. Standalone stores (`authStore`, `focusedHeadingStore`, `sheetStore`, `themeStore`, the chat-domain `useChatStore`) live alongside but are not folded in. All `useStore` calls must use leaf selectors; never select `(state) => state` or `(state) => state.settings`.
- **Canonical editor handle:**

```ts
useStore((state) => state.settings.editor.instance)
```

- Registered by `useEditorAndProvider.ts` via `setWorkspaceEditorSetting('instance', editor)`.
- Consumers: `EditorContent.tsx`, `useTocActions.tsx`, the toolbar, collaboration-document features.
- `window._editor` and `window._store` are set only by `pages/editor.tsx` (standalone playground); both are undefined on real document/collab routes. Do not add new `window._editor` readers to document-route features.
- React mobile sheets that need an editor reference use typed `SheetDataMap` payloads (e.g. `linkPreview`, `linkEditor`), not globals.
- **ProseMirror state pitfalls:**
  - `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
  - `transaction.before` is the pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
  - For fold-driven UI such as TOC, snapshot heading-fold plugin state from `editor.state` and diff across transactions.
- **Indent lockstep.** Pad `TipTap.tsx` and the chat composer `useTiptapEditor` must stay on the same `Indent.configure({ indentChars: '\t' })` — widen both or neither. The full rule and the Tab/Shift-Tab order live in [extensions/CLAUDE.md](../../../../../extensions/CLAUDE.md) §Indent Extension, which does not load here.
