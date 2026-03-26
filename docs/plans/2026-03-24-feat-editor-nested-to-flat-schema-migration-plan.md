---
title: 'Editor Schema Migration: Nested → Flat'
type: feat
status: active
date: 2026-03-24
brainstorm: docs/brainstorms/2026-03-24-editor-schema-migration-brainstorm.md
---

# Editor Schema Migration: Nested → Flat

## Overview

Replace the nested ProseMirror heading schema (`doc → heading → contentHeading + contentWrapper`) with a flat document model (`heading block*`) powered by decoration-based extensions from [docs-plus/editor](https://github.com/docs-plus/editor). This removes ~25 custom files, 4 custom nodes, all hierarchy enforcement logic, and ~60 coupled test files — replacing them with standard TipTap StarterKit nodes + 4 decoration plugins.

**Net effect:** The editor goes from a custom schema where every paste, keystroke, and collab step must survive hierarchy validation to a standard ProseMirror flat doc where sections are a rendering concern, not a structural one.

**Expert support:** ProseMirror team and TipTap team are available for consultation on edge cases.

## Problem Statement

The nested heading architecture is the single largest source of editor bugs, dev friction, and maintenance burden:

- **Schema violations** — paste, undo/redo, and concurrent edits regularly produce invalid nesting that triggers hierarchy validation repairs, sometimes losing content.
- **25+ tightly-coupled files** — changing any heading behavior requires touching multiple interconnected modules.
- **Custom everything** — standard ProseMirror/TipTap operations (keyboard shortcuts, input rules, list toggling) are overridden or broken by the nested schema, requiring bespoke reimplementation.
- **Testing surface** — 22 unit tests + ~50 Cypress tests exist specifically to cover nested schema edge cases that shouldn't need to exist.

## Proposed Solution

Adopt the proven architecture from docs-plus/editor:

1. **Flat document schema** — `TitleDocument` node enforces `heading block*` (first child is always a heading, followed by standard blocks).
2. **Decoration-based sections** — `computeSection()` dynamically determines heading section boundaries. Fold, drag, scale, and filter all use `DecorationSet` — they never mutate document structure.
3. **StarterKit** — use `@tiptap/starter-kit` for Heading, Paragraph, Text, and all default extensions. Disable StarterKit's `document` (replaced by `TitleDocument`).
4. **4 independent extensions** — HeadingScale, HeadingFold, HeadingDrag, HeadingFilter — each self-contained with its own plugin state.

## Architecture

```
BEFORE                              AFTER
──────                              ─────
doc (heading+)                      doc (TitleDocument: heading block*)
  └── heading                         ├── heading (level: 1, data-toc-id)
        ├── contentHeading            ├── paragraph
        └── contentWrapper            ├── heading (level: 2, data-toc-id)
              ├── paragraph           ├── paragraph
              ├── bulletList          ├── bulletList
              └── heading (nested)    ├── heading (level: 3, data-toc-id)
                    ├── ...           └── ...
                    └── ...
                                    Sections computed via computeSection()
                                    Fold/scale/drag/filter via DecorationSet
```

## Behavioral Contracts

These invariants must hold at all times. Each has a corresponding verification in the phase where it's implemented.

| #    | Invariant                                                                  | Enforcement                                                                                                          | User-visible behavior                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BC-1 | First node is always heading with `level: 1`                               | `TitleDocument.appendTransaction` silently normalizes                                                                | User cannot demote title — `Mod-Alt-3` on title is a no-op                                                                                                                                                                        |
| BC-2 | Heading levels are H1–H6 only                                              | StarterKit Heading config `levels: [1,2,3,4,5,6]` + `TitleDocument.handlePaste`                                      | H7+ from paste: `<h7>` tags fall through as paragraphs (StarterKit parseHTML only registers h1–h6). This is correct — matches browser/editor industry behavior. No clamping needed.                                               |
| BC-3 | Cursor never rests inside folded content (keyboard)                        | `HeadingFold.handleKeyDown` intercepts ArrowUp/ArrowDown; checks `isPositionFolded()` and jumps past folded sections | Arrow-down into folded section jumps to `sectionTo` (next visible block); Arrow-up jumps to heading end position. **v1 scope: keyboard only.** Mouse/programmatic cursor in folded content is a known gap — tracked as follow-up. |
| BC-4 | Section = heading + all content until next heading of same or higher level | `computeSection()` algorithm                                                                                         | Drag/fold/delete operate on this exact boundary                                                                                                                                                                                   |
| BC-5 | `data-toc-id` is stable across collab sessions                             | `UniqueID.filterTransaction` skips Yjs-origin txns                                                                   | Deep links and chat threads don't break on remote edits                                                                                                                                                                           |
| BC-6 | Editing is possible in filtered view                                       | HeadingFilter hides non-matching sections via temporary folds (HeadingFoldAdapter); doc remains structurally intact  | Content typed in visible sections persists; hidden sections untouched                                                                                                                                                             |
| BC-7 | Folded sections expand for print                                           | Print CSS overrides fold decorations                                                                                 | `@media print` shows all content                                                                                                                                                                                                  |
| BC-8 | Decoration mapping failure → full recompute                                | `canMapDecorations` fallback in each plugin                                                                          | Brief visual flash, no data loss                                                                                                                                                                                                  |
| BC-9 | Deep link to deleted heading → open doc at top                             | Filter/scroll code handles missing ID gracefully                                                                     | No error; doc opens normally                                                                                                                                                                                                      |

## Implementation Phases

### Phase 0: Source the Extensions (prerequisite)

Copy the new extensions from `docs-plus/editor` into the workspace.

**Tasks:**

- [ ] Clone `docs-plus/editor` locally (temporary — file extraction only)
- [ ] Copy into `packages/webapp/src/components/TipTap/extensions/`:
  - `title-document/` — TitleDocument node
  - `heading-scale/` — HeadingScale decoration plugin
  - `heading-fold/` — HeadingFold + animated crinkle UI
  - `heading-drag/` — HeadingDrag with floating handle
  - `heading-filter/` — HeadingFilter with OR/AND logic
  - `shared/` — `computeSection`, `canMapDecorations`, `findAllSections`, `filterSections`, `matchSections`
- [ ] Verify license compatibility (docs-plus/editor is MIT — confirm before vendoring)
- [ ] **Rewrite import paths:** all plugins import from `@/extensions/shared` (docs-plus alias). Replace with relative imports matching the project's structure (e.g. `../shared`)
- [ ] **Patch PM attribute key:** source reads `node.attrs["data-toc-id"]` in 6+ places across fold, filter, and match-section. Since we configure UniqueID with `attributeName: 'toc-id'` (PM key = `toc-id`), replace all `attrs["data-toc-id"]` with `attrs["toc-id"]` in vendored code. Use `getTocId()` helper where appropriate.
- [ ] **Extract `moveSection` utility** into `shared/move-section.ts`: the section-move logic is inline in `heading-drag-plugin.ts` (`onDragUp` handler). Extract it as a standalone `moveSection(tr, sectionFrom, sectionTo, targetPos)` function — it's needed by TOC drag (Phase 4) too.
- [ ] **Rename CSS custom properties** in vendored SCSS: `--tt-fold-duration` → `--editor-fold-duration`, `--tt-transition-easing-cubic` → `--editor-easing-cubic`, `--tt-border-color-tint` → `--border-color-tint`. No product or library branding in custom properties.
- [ ] **Copy SCSS files** alongside `.ts` files:
  - `heading-fold/heading-fold.scss` — crinkle animation, fold/unfold keyframes, dark mode, mobile
  - `heading-drag/heading-drag.scss` — drag handle, ghost, drop indicator styles
  - `heading-filter/heading-filter.scss` — filter highlight styles
  - `shared/heading-node.scss` — base h1–h6 typography with `var(--hd-size)` fallbacks
- [ ] Verify all copied extensions compile with `^3.20.0` TipTap deps
- [ ] Record upstream commit SHA in a comment at top of each copied directory's `index.ts` (e.g. `// Vendored from docs-plus/editor@abc1234`)
- [ ] Remove cloned repo after extraction

**Verification (BC checks):**

- [ ] `TitleDocument` has **two plugins**: (1) `enforceH1Title` appendTransaction — forces `level: 1` on first heading; (2) `titlePasteHandler` handlePaste — intercepts full-doc paste (pos 0, `openStart === 0`) and promotes first block to H1 → **BC-1** ✅ (confirmed in source)
- [ ] `HeadingFold` handles cursor via `handleKeyDown` intercepting ArrowUp/ArrowDown, using `isPositionFolded()` → **BC-3** ✅ (confirmed: ArrowDown jumps past `sectionTo`, ArrowUp jumps to heading end)
- [ ] `HeadingFold` does **NOT** handle cursor from mouse click, `setTextSelection`, or gapcursor — **accepted for v1**. File follow-up issue for `appendTransaction`-based cursor correction after migration ships.
- [ ] `computeSection()` handles: end-of-document, consecutive headings, skipped levels, single-heading doc → **BC-4** (algorithm: linear walk of top-level children from heading's index forward, stops at first heading with `level <= L` or `doc.content.size`)
- [ ] `computeSection()` accepts optional `startChildIndex` param for O(k) fast path (avoid O(N) leading scan)
- [ ] All 4 decoration plugins implement `canMapDecorations` fallback → **BC-8** ✅ (confirmed: checks single step, `ReplaceStep`, same parent, no heading nodes in slice; falls back to full rebuild otherwise)

**Success criteria:** All 6 extension directories exist with SCSS, compile, imports resolve, PM attr key is `toc-id`, `moveSection` is exported from shared.

**Effort:** 1–2 days

---

### Phase 1: Schema Swap — Nodes & Core Editor

Replace the document schema and editor setup. After this phase, the editor loads with the flat schema. Everything heading-related downstream is broken — that's expected.

**Tasks:**

- [ ] **Delete custom nodes:**
  - `nodes/ContentHeading.ts`
  - `nodes/ContentWrapper.ts`
  - `nodes/Heading.ts`
  - `nodes/Document.ts`
  - `nodes/Paragraph.ts`
  - `nodes/Text.ts`
  - Keep: `nodes/MediaUploadPlaceholder.tsx`

- [ ] **Delete all heading extensions:**
  - `extensions/changeHeadingLevel.ts` (+ backward, forward, h1 variants)
  - `extensions/changeHeadingToParagraphs.ts`
  - `extensions/wrapContentWithHeading.ts`
  - `extensions/deleteSelectedRange.ts`
  - `extensions/clipboardPaste.ts`
  - `extensions/validateHeadingHierarchy.ts`
  - `extensions/types.ts`, `extensions/helper.ts`
  - `extensions/helper/clipboard.ts`, `headingMap.ts`, `nodeState.ts`, `selection.ts`
  - `extensions/normalText/onHeading.ts`, `onSelection.ts`
  - `extensions/testUtils/testSchema.ts`

- [ ] **Delete heading plugins:**
  - `extensions/plugins/copyPastePlugin.ts`
  - `extensions/plugins/hierarchyValidationPlugin.ts`
  - `extensions/plugins/rangeSelectionPlugin.ts`
  - `extensions/plugins/crinklePlugin.ts`
  - Update `extensions/plugins/index.ts` — only export `decorationHelpers`

- [ ] **Rewrite `TipTap.tsx`:**

  **StarterKit configuration:**

  ```ts
  StarterKit.configure({
    document: false, // replaced by TitleDocument
    undoRedo: false, // required when using Collaboration (NOT `history: false` — renamed in v3)
    heading: {
      levels: [1, 2, 3, 4, 5, 6]
    }
    // StarterKit v3.20.0 bundles: Bold, Code, Italic, Link, Strike, Underline,
    // Blockquote, BulletList, CodeBlock, HardBreak, Heading, HorizontalRule,
    // ListItem, OrderedList, Paragraph, Text, Dropcursor, Gapcursor,
    // TrailingNode, UndoRedo, ListKeymap
    // NOTE: also bundles Link and Underline — check for duplicate registration
  })
  ```

  **Register new extensions:**

  ```ts
  TitleDocument,           // replaces Document node
  HeadingScale,
  HeadingFold.configure({ documentId }),  // fold persistence key
  HeadingDrag,
  HeadingFilter.configure({  // foldAdapter is REQUIRED — visual filtering works entirely through temporary folds
    foldAdapter: { getFoldedIds, setTemporaryFolds, restoreFolds },
    onFilterChange: (state) => { /* update filter UI */ },
  }),
  TableOfContents.configure({
    anchorTypes: ['heading'],
    onUpdate: (anchors) => { /* feed TOC UI */ },
  }),
  ```

  **UniqueID config — CRITICAL:** `attributeName` must be `'toc-id'` (renders as `data-toc-id`). Using `'data-toc-id'` would produce `data-data-toc-id`.

  ```ts
  UniqueID.configure({
    attributeName: 'toc-id', // → HTML attr: data-toc-id
    types: ['heading', 'hyperlink', 'table'],
    filterTransaction: (tr) => !isChangeOrigin(tr),
    generateID: () => new ShortUniqueId().stamp(16)
  })
  ```

  **⚠️ RESOLVED — UniqueID is the single ID source (not TableOfContents):**

  TableOfContents 3.20.0 hardcodes `data-toc-id` and has its own ID-stamping `appendTransaction`. UniqueID also stamps `data-toc-id` (via `attributeName: 'toc-id'`). Having two writers creates a race condition — especially under Yjs collaboration where `appendTransaction` ordering is not guaranteed.

  **Decision: UniqueID is the single ID source.** Rationale:
  - UniqueID has `filterTransaction` for Yjs — skips ID stamping on remote transactions (prevents fighting the CRDT)
  - UniqueID uses our custom `generateID` (`ShortUniqueId().stamp(16)`) — consistent with existing IDs
  - UniqueID handles `types: ['heading', 'hyperlink', 'table']` — covers non-heading nodes too
  - TableOfContents should **consume** the ID attribute, not stamp it

  **Action:** After copying ToC extension, **remove or disable its ID-stamping `appendTransaction`**. Keep only its `onUpdate` data pipeline and scroll spy. If that's not cleanly separable, use ToC as data-only (read `data-toc-id` from existing attrs, never write).

  **⚠️ TableOfContents 3.20.0 has no Yjs guards** — its `appendTransaction` runs on collab syncs too. This is another reason to disable its ID stamping and let UniqueID handle it.
  - Remove imports of `Document`, `Heading`, `ContentHeading`, `ContentWrapper`, `Paragraph`, `Text`
  - Remove individual `@tiptap/extension-*` deps covered by StarterKit (bold, italic, strike, code, codeBlock, blockquote, bulletList, orderedList, listItem, hardBreak, horizontalRule, link, underline, dropcursor, gapcursor)
  - **Keep** (not in StarterKit): `UniqueID`, `Indent`, `Hyperlink`, `HyperMultimediaKit`, `Table*`, `TaskList/TaskItem`, `HeadingActionsExtension`, `Collaboration*`, `TextAlign`, `Superscript`, `Subscript`, `Highlight`, `Typography`, `InlineCode`, `OptimizedPlaceholder`, `IOSCaretFix`
  - **Check for duplicates**: StarterKit now bundles Link and Underline — verify these aren't also registered separately

- [ ] **Update `types/tiptap.ts`:**
  - Remove `CONTENT_HEADING_TYPE`, `CONTENT_WRAPPER_TYPE` from `TIPTAP_NODES` (grep for both the constant AND string literals `'contentHeading'`/`'contentWrapper'` that bypass the constant)
  - Remove `heading.normalText`, `heading.wrapBlock` command augmentations (misaligned with runtime anyway — `TipTapEditor = any` masked this)
  - Remove fold/heading-specific `TRANSACTION_META` entries (now plugin-driven); grep `getMeta`/`setMeta` for those strings to catch all usages
  - Keep: `HEADING_TYPE`, `DOC_TYPE`, `TIPTAP_EVENTS`, `TipTapEditor`, core re-exports

- [ ] **Add shared `getTocId` helper** (resolves PM attr key confusion):

  ```ts
  // After Phase 0, verify actual PM attr key by logging a serialized heading node
  export function getTocId(attrs: Record<string, unknown>): string | undefined {
    const v = attrs['toc-id'] // UniqueID with attributeName: 'toc-id' → PM schema attr is 'toc-id'
    return typeof v === 'string' ? v : undefined
  }
  ```

  Use this helper everywhere instead of raw `node.attrs['data-toc-id']` or `node.attrs.id`. The DOM attribute is `data-toc-id` but the **PM schema attribute key** is `toc-id`.

- [ ] **Add y-sync$ guard to all decoration plugins** — in each of the 4 decoration plugins (fold, scale, drag, filter), add an explicit check:

  ```ts
  if (tr.getMeta('y-sync$')) {
    // Force full decoration rebuild — never trust DecorationSet.map for remote transactions.
    // Each plugin already has a full rebuild path (the `canMapDecorations` false branch) — invoke it.
    return buildAllDecorations(tr.doc, pluginState)
  }
  ```

  This prevents stale/corrupt decorations from Yjs remote transactions where `DecorationSet.map()` is unreliable ([y-prosemirror#49](https://github.com/yjs/y-prosemirror/issues/49)).

- [ ] **Rename localStorage key** — `tinydocy-folds-{documentId}` → `editor-folds-{documentId}` in `fold-storage.ts` (`STORAGE_PREFIX`). No product branding in storage keys. Add one-time migration: on init, if old key exists, copy value to new key and delete old key. This prevents silent fold-state reset for all users.

- [ ] **Clean up `package.json`** — remove individual `@tiptap/extension-*` deps covered by StarterKit

**Verification:**

- [ ] Editor boots with flat schema — `<h1>` through `<h6>` elements render
- [ ] `#`, `##`, `###` input rules create headings → **BC-2**
- [ ] `Mod-Alt-1` through `Mod-Alt-6` toggle heading levels
- [ ] First node is always H1 → **BC-1**
- [ ] `data-toc-id` stamped on heading nodes → **BC-5**
- [ ] Collaboration syncs the flat document between two tabs

**Success criteria:** Editor loads, creates/toggles headings, collaborates. Decorations render. TOC/chatroom/filters/toolbar broken (expected).

**Effort:** 2–3 days

---

### Phase 2: Toolbar & Simple UI Fixes

Fix the toolbar and other simple UI entry points that reference the old schema.

**Tasks:**

- [ ] **`toolbar/StyleSelect.tsx`:**
  - `editor.isActive('contentHeading', { level })` → `editor.isActive('heading', { level })`
  - `wrapBlock({ level })` → `editor.chain().focus().toggleHeading({ level }).run()`
  - `normalText()` → `editor.chain().focus().setParagraph().run()`
  - Heading range: H1–H6 only (drop H7–H10 options)
  - Shortcut tooltips: `⌘+⌥+[1-6]`

- [ ] **`toolbarMobile/HeadingSelection.tsx`:**
  - Same pattern as `StyleSelect.tsx`
  - DOM traversal → detect heading level from flat `<h1>`–`<h6>` elements
  - Level bounds: cap at 6
  - Title H1 protection: rewrite for TitleDocument (first heading in doc)

- [ ] **`toolbar/toolbarUtils.ts`:**
  - `searchThroughHeading()`: `.title` → `'h1,h2,h3,h4,h5,h6'` or `'[data-toc-id]'`
  - `highlightTocHeadings()`: `.heading[data-id]` → `[data-toc-id]`

- [ ] **`AppendHeadingButton.tsx`:**
  - Replace nested JSON with flat: `{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }`

- [ ] **`createDocumentFromStructure.ts`:**
  - Replace nested heading JSON generation with flat `heading` + `paragraph` sequence

**Verification:**

- [ ] Desktop toolbar heading dropdown: H1–H6 select correctly, "Normal text" works
- [ ] Mobile heading stepper: increment/decrement within H1–H6
- [ ] Append heading button inserts new section at end of doc

**Effort:** 1 day

---

### Phase 3: HeadingActions Plugin Rewrite

Update the three HeadingActions sub-plugins for the flat schema.

**Tasks:**

- [ ] **Delete `headingTogglePlugin.ts`** — replaced by HeadingFold extension

- [ ] **Rewrite `hoverChatPlugin.ts`:**
  - Remove `CONTENT_HEADING_TYPE` tracking
  - `findHeadingNodes()` → `doc.descendants()` checking `node.type.name === 'heading'`
  - `findSelectionHeadingId()` → `$anchor.parent.type.name === 'heading' ? getTocId($anchor.parent.attrs) : null` (use the shared `getTocId` helper — PM schema key is `toc-id`, not `data-toc-id`)
  - Heading is at depth 1 — no ancestor walk
  - `targetNodeTypes` → `['heading']`

- [ ] **Rewrite `selectionChatPlugin.ts`:**
  - `shouldShow()` → check `heading` type instead of `CONTENT_HEADING_TYPE`
  - `findAncestorOfType()` simplified: heading at depth 1

- [ ] **Update `HeadingActionsExtension.ts`:** remove `headingToggle` option
- [ ] **Update `HeadingActions/types.ts`:** drop `headingToggle` from options
- [ ] **Update `HeadingActions/index.ts`:** remove `headingTogglePlugin` re-export

**Verification:**

- [ ] Hovering over heading shows chat button with correct heading ID
- [ ] Selection within heading shows selection chat UI
- [ ] Chat opens for the correct heading

**Effort:** 1 day

---

### Phase 4: TOC Rewrite

Second-largest piece after the schema swap. The TOC system is deeply coupled to nested structure.

**Tasks:**

- [ ] **Rewrite `hooks/useToc.ts`:**
  - Replace `contentHeading` node walking with `@tiptap/extension-table-of-contents` data
  - Read fold state from `headingFoldPluginKey` instead of `getNodeState()` / localStorage
  - Generate `TocItem[]` from `TableOfContentData`

- [ ] **Rewrite `hooks/useTocDrag.ts`** (630 → ~100 lines):
  - **Section drag semantics (BC-4):** "move section" = heading + all content until next heading of same-or-higher level. This matches `computeSection()` boundaries exactly.
  - `processHeadingForLevelChange` → `tr.setNodeMarkup(pos, null, { level: newLevel })`
  - `calculateInsertPos` (130 lines of manual position tracking) → `computeSection()` + before/after (~10 lines)
  - Transaction execution → `moveSection` from shared utilities. **Transaction ordering matters:** moving UP = insert at target first, then delete mapped source; moving DOWN = delete source first, then insert at mapped target. This keeps ProseMirror mapping correct.
  - `findHeadingById` / `getAllHeadings` → `findAllSections()`
  - **Undo:** single `moveSection` call = single undo step (all steps in one `tr.dispatch()`; no separate transactions that could interleave with Yjs syncs)

- [ ] **Rewrite `utils/moveHeading.ts`** → delegate to shared `moveSection` (or delete and import directly)

- [ ] **Rewrite `hooks/useTocActions.tsx`:**
  - DOM selectors: `.heading[data-id]` → `[data-toc-id]`
  - Delete section: `computeSection(doc, pos, level)` → `tr.delete(from, to)`

- [ ] **Update `hooks/useHeadingScrollSpy.ts`:** `.heading[data-id]` → `[data-toc-id]`
- [ ] **Update `hooks/useActiveHeading.ts`:** replace with TOC extension's active heading tracking if it provides equivalent scroll-position-based active heading; otherwise keep and update selectors from `.heading[data-id]` → `[data-toc-id]`
- [ ] **Update `toc/utils.ts`:** selector and URL path updates
- [ ] **Update `TocContextMenu.tsx`:** selectors + delete logic via `computeSection()`
- [ ] **Verify `dnd/` utilities:** `flattenTocItems`, `getDescendantCount`, etc. operate on `TocItem` data — should work; fix any DOM selector references

- [ ] Keep as-is: `usePresentUsers.ts`, `useUnreadCount.ts`, `focusedHeadingStore.ts`

**Verification:**

- [ ] TOC renders correct hierarchy from flat document
- [ ] TOC drag-and-drop moves sections correctly (verify BC-4 boundaries)
- [ ] TOC context menu: delete section, link section, fold toggle
- [ ] Heading scroll spy highlights current section
- [ ] Desktop and mobile TOC layouts work

**Effort:** 3–4 days

---

### Phase 5: Chatroom, Filter, App-Level Code & Styles

Fix all remaining code that references the nested schema.

#### Chatroom

- [ ] **Rewrite `useCopyMessageToDocHandler.ts`:**
  - Replace `headingContentNode.nodeSize + 2` → `computeSection(doc, pos, level)` → insert at section body
  - Handle case where filter is active (insert into actual doc position, not visual position)

- [ ] **Rewrite `useReplyInThreadHandler.ts`:**
  - Replace `createHeadingNodeJson` with flat: `{ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }` + paragraphs (`toc-id` attr is stamped automatically by UniqueID after insertion — don't set it manually)
  - Insert at `computeSection().to`

- [ ] **Update `useTurnSelectedTextIntoComment.tsx`:** `attrs.id` → `getTocId(attrs)` (shared helper; PM key is `toc-id`)

- [ ] **Rewrite Breadcrumb** (`Breadcrumb.tsx` + `BreadcrumbMobile.tsx`):
  - In flat doc, `resolve(pos).path` is just `[doc, heading]` — no nested ancestors
  - Rewrite: walk backward through top-level children, collecting nearest heading at each lower level
  - `x.firstChild.textContent` → `x.textContent`

#### Filter

- [ ] **Delete `hooks/helpers/filterLogic.ts`** — replaced by HeadingFilter's `filterSections()`

- [ ] **Rewrite `hooks/useApplyFilters.ts`:**
  - Wire to HeadingFilter commands: `editor.commands.applyFilter(slugs, mode)`
  - HeadingFilter has full `filterSections()` with OR/AND logic, ancestor/descendant expansion — evaluate if it replaces the weighted classification algorithm. If not, port the algorithm to use `findAllSections()` + `computeSection()`.
  - **URL scheme adaptation:** HeadingFilter uses query params (`?filter=a|b&mode=or`). This project uses path-based URLs (`/doc/heading-slug-1/heading-slug-2`). Write an adapter: `readFilterUrl()` reads path segments → `applyFilter(slugs, mode)`. `updateFilterUrl()` converts filter state back to path segments. The `filter-url.ts` helpers from docs-plus/editor are a reference but need rewriting for path-based routing.
  - **Filter + fold integration:** HeadingFilter has a `HeadingFilterFoldAdapter` interface that saves/restores fold state during filtering. Wire `HeadingFold`'s plugin key to this adapter so filter doesn't permanently destroy fold state.
  - **Filter + edit policy (BC-6):** non-matching sections are hidden via temporary folds (HeadingFoldAdapter), but the document remains structurally intact and editable. Typing in visible sections works normally. Hidden sections are untouched. Cursor relocation: when filter activates and cursor is in a non-matching section, HeadingFilter moves cursor to position 1 (start of title).
  - **Missing heading in URL (BC-9):** if `data-toc-id` from URL doesn't exist → open doc at top, clear filter params

#### Events & Utilities

- [ ] **Update `services/eventsHub.ts`:** remove `.wrapBlock[data-id]`, use `[data-toc-id]`
- [ ] **Update `utils/scrollToHeading.ts`:** `.heading[data-id="..."]` → `[data-toc-id="..."]`
- [ ] **Update `utils/index.ts`** (`getPostAtDOM`): same selector update

#### Database / Hooks

- [ ] **Delete `db/headingCrinkleDB.ts`** (Dexie/IndexedDB) — HeadingFold uses **localStorage** natively (key: `editor-folds-{documentId}`, renamed in Phase 1). The Dexie DB is no longer needed.

- [ ] **Rewrite `hooks/useDocumentMetadata.ts`:**
  - Remove heading map loading from IndexedDB/localStorage
  - Remove `headingCrinkleDB` import and `initDB()` call
  - HeadingFold handles its own persistence to localStorage

#### Editor Preferences

- [x] **Removed `stores/editorPreferences.ts`** and GearModal page-preference toggles (`indentHeading`, `h1SectionBreak`) — not needed for flat schema; avoid duplicate styling paths.

#### Test Infrastructure

- [ ] **Rewrite `pages/editor.tsx`:**
  - `window._moveHeading` → use `moveSection`
  - `window._createDocumentFromStructure` → flat JSON builder

- [ ] **Rewrite `hooks/useHierarchicalSelection.ts`:**
  - `selectHierarchical('section')` → `[data-toc-id]` or `h1`–`h6` selectors

- [ ] **Update `Controllers.tsx`:** wire to rewritten selection hooks

#### Styles

- [ ] **Delete `styles/_headings.scss`** (172 lines, 100% coupled) and replace with:
  - **Import vendored SCSS** (copied in Phase 0): `heading-node.scss` (base h1–h6 typography + `var(--hd-size)` fallbacks), `heading-fold.scss` (crinkle animation, dark mode, mobile), `heading-drag.scss` (handle, ghost, indicator), `heading-filter.scss` (highlight)
  - **Add project-specific rules** not in vendored styles:
    - `[data-toc-id]` selectors (if needed beyond vendored base)
    - ~~`body.indentHeading` / `body.h1SectionBreak`~~ — removed (no user toggles)
    - **Print (BC-7):** `@media print { .heading-fold-hidden { display: block !important; } .heading-fold-crinkle { display: none; } }`
  - Verify vendored CSS custom properties were renamed in Phase 0 (`--tt-*` → `--editor-*`). Map to project design tokens where equivalents exist.

- [ ] **Update `styles/styles.scss`:**
  - Delete lines 12–342 (`.foldWrapper`, `div.heading`, `.wrapBlock`, keyframes)
  - Keep non-heading code (modals, hyperlink popovers, media toolbar)
  - Remove `@use './headings'`

- [ ] **Update `styles/_mobile.scss`:**
  - `.heading`, `.contentWrapper` → `h1,h2,h3,h4,h5,h6`
  - Delete `.foldWrapper .fold` rules (HeadingFold handles this)
  - Keep `.headingSelection` (toolbar UI, not schema-coupled)

- [ ] **Update `styles/_blocks.scss`:** 3 selectors → flat heading selectors
- [ ] **Update `styles/_print.scss`:** `.heading` → `:is(h1,h2,h3,h4,h5,h6)`
- [ ] **Adapt `styles/components/_heading-actions.scss`:** `.title` parent → flat heading context

**Verification:**

- [ ] Copy-to-doc inserts at correct position (including when filter is active)
- [ ] Reply-in-thread creates heading correctly
- [ ] Breadcrumb shows correct heading ancestry
- [ ] Filter bar works; URL deep-linking resolves correctly; missing ID → opens at top (BC-9)
- [ ] Fold state persists across reload; cleared on doc clone
- [x] ~~`indentHeading` / `h1SectionBreak`~~ — features removed
- [ ] Print shows all content including folded sections (BC-7)
- [ ] No orphan SCSS selectors or missing styles

**Effort:** 4–5 days

---

### Phase 6: Test Cleanup & New Tests

Delete remaining nested-schema-coupled tests (some already deleted incrementally with Phases 1–5). Write focused smoke tests for the flat schema.

**Note:** Delete tests incrementally as each phase lands — don't wait for Phase 6. Tests that only target removed nodes/extensions should be deleted in the same PR that removes those nodes. This keeps CI meaningful throughout the migration instead of creating a test gap.

**Tasks:**

- [ ] **Delete remaining unit test files** under `extensions/__tests__/` (22 total — some may already be gone from Phase 1)

- [ ] **Delete remaining Cypress test directories:**
  - `cypress/e2e/editor/heading/` (~24 files)
  - `cypress/e2e/editor/schema/` (2 files)
  - `cypress/e2e/editor/doc-schema-generator/` (5 files)
  - `cypress/e2e/editor/copy-paste/` (~15 files)
  - `cypress/e2e/editor/edge-cases/` (2 files)
  - `cypress/e2e/editor/manual-browser-test/` (3 files)
  - `cypress/e2e/editor/toc/` (2 files — rewrite after)
  - `cypress/e2e/cypress-commands/` (4 files)

- [ ] **Delete Cypress support files:**
  - `cypress/support/schemaValidator.js`
  - `cypress/support/domSchemaValidator.js`
  - `cypress/fixtures/cypress-commands/validateDomStructure/`
  - `cypress/fixtures/minimax-article.html`

- [ ] **Rewrite `cypress/support/commands.ts`:**
  - Remove: `createHeading`, `createIndentHeading`, `putPosCaretInHeading`, `applyHeadingLevelChange`, `validateHeadingLevelChange`, `moveHeading`, `.contentWrapper` validators
  - Add: flat-schema heading creation, `[data-toc-id]`-based selectors

- [ ] **Rewrite Cypress fixtures** (`createSelection/` — 7 HTML files) for flat schema

- [ ] **Rewrite Cypress tests:**
  - `user-behavior/keyboard-shortcuts.cy.js`
  - `user-behavior/toolbar-shortcut-parity.cy.js`
  - `user-behavior/editing-flows.cy.js`
  - `keyboard-action-flow/select-all-and-empty-doc.cy.js`

- [ ] **Verify "keep" tests pass** (after `commands.ts` rewrite):
  - `formatting/` (7 files)
  - `lists/` (7 files)

- [ ] **Write new flat-schema smoke tests:**
  - `heading/heading-create-input-rules.cy.js` — `# `, `## `, etc.
  - `heading/heading-toggle-toolbar.cy.js` — toolbar level selection
  - `heading/heading-fold-unfold.cy.js` — fold/unfold + cursor behavior (BC-3)
  - `toc/toc-render-and-drag.cy.js` — TOC rendering + drag-and-drop (BC-4)
  - `copy-paste/standard-paste.cy.js` — paste with headings (standard PM behavior)
  - `copy-paste/full-doc-paste.cy.js` — ⌘A→⌘V (critical scenario per AGENTS.md)
  - `collaboration/collab-heading-sync.cy.js` — two tabs, heading operations

**Verification:**

- [ ] All remaining Cypress tests pass
- [ ] No import errors from deleted files
- [ ] `bun run test` passes
- [ ] Coverage thresholds in `package.json` still met (adjust editor-core paths if needed)

**Effort:** 2–3 days

---

### Release QA Checklist (replaces former Phase 7)

Behavioral verification items are distributed across Phases 1–6. This checklist is the final gate before shipping. Run after Phase 6.

**Title H1 (BC-1):**

- [ ] `Mod-Alt-3` on title → stays H1
- [ ] Paste H3 as first node → normalized to H1
- [ ] Full-doc paste (⌘A→⌘V) → title stays H1

**Cursor + Fold (BC-3):**

- [ ] Arrow-down into folded section → jumps past section
- [ ] Arrow-up into folded section → jumps to heading end
- [ ] Mouse click near fold boundary → **known v1 gap** (cursor may land in folded content; follow-up issue filed)
- [ ] Gapcursor doesn't land in folded content → **known v1 gap** (same follow-up)

**Collaboration (BC-5, BC-8):**

- [ ] Client A folds, Client B types in that section → fold decorations remap
- [ ] Two clients create headings simultaneously → no duplicate `data-toc-id`
- [ ] Large remote transaction → all 4 plugins recover (y-sync$ guard forces full rebuild)
- [ ] No console errors during interleaved fold/filter + remote edits

**computeSection (BC-4):**

- [ ] End of document, consecutive headings, skipped levels, single-heading doc all work
- [ ] Profile with 500+ heading fixture → if jank, implement shared heading index (measure first; [discuss#5992](https://discuss.prosemirror.net/t/is-there-a-more-efficient-approach-to-updating-decorations-when-the-document-changes-than-scanning-the-entire-document/5992))

**Paste (BC-2):**

- [ ] `<h7>` tag paste → falls through as paragraph (correct behavior — no clamping needed)

**Mobile:**

- [ ] HeadingDrag handle: mouse-only (known limitation; no touch support)
- [ ] TOC sidebar DnD (`@dnd-kit`) works on mobile as the alternative drag path

---

## File Inventory Summary

| Category        | Delete                                  | Rewrite                                            | Update                                             | Add     | Keep                          |
| --------------- | --------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ------- | ----------------------------- |
| Custom nodes    | 6                                       | —                                                  | —                                                  | —       | 1 (MediaUploadPlaceholder)    |
| Extensions      | 18                                      | —                                                  | —                                                  | 6 dirs  | —                             |
| Plugins         | 4                                       | —                                                  | 1 (index.ts)                                       | —       | 1 (decorationHelpers)         |
| HeadingActions  | 1 (toggle)                              | 2 (hover, selection)                               | 3 (ext, types, index)                              | —       | —                             |
| TOC hooks       | —                                       | 4 (useToc, useTocDrag, useTocActions, moveHeading) | 3 (scrollSpy, activeHeading, utils)                | —       | 2 (presentUsers, unreadCount) |
| Chatroom        | —                                       | 3 (copyToDoc, replyThread, breadcrumb×2)           | 1 (turnSelectedText)                               | —       | ~13                           |
| Filter          | 1 (filterLogic)                         | 1 (useApplyFilters)                                | —                                                  | —       | —                             |
| Styles          | 1 (\_headings)                          | —                                                  | 5 (styles, mobile, blocks, print, heading-actions) | —       | —                             |
| Types           | —                                       | —                                                  | 1 (tiptap.ts)                                      | —       | —                             |
| Utilities       | —                                       | —                                                  | 3 (scrollToHeading, index, eventsHub)              | —       | —                             |
| DB/Stores       | 2 (headingCrinkleDB, editorPreferences) | 1 (useDocumentMetadata)                            | —                                                  | —       | 1 (focusedHeadingStore)       |
| Test infra      | —                                       | 2 (editor.tsx, useHierarchicalSelection)           | 1 (Controllers)                                    | —       | —                             |
| Unit tests      | 22                                      | —                                                  | —                                                  | —       | —                             |
| Cypress tests   | ~55                                     | 4                                                  | —                                                  | ~7 new  | 14 (formatting + lists)       |
| Cypress support | 3                                       | 1 (commands.ts)                                    | —                                                  | —       | —                             |
| **Total**       | **~111**                                | **~18**                                            | **~19**                                            | **~13** | **~33**                       |

## Dependencies & Prerequisites

1. **docs-plus/editor repo access** — must clone/download for extension extraction. Phase 0 blocker.
2. **`@tiptap/starter-kit`** — already in `package.json` (`^3.20.0`). Currently only used in chat composer. Will become the main editor base.
3. **`@tiptap/extension-table-of-contents`** — already in `package.json` (`^3.20.0`). Not imported yet.
4. **`@tiptap/extension-unique-id`** — already configured. Needs: `attributeName: 'toc-id'` (NOT `'data-toc-id'` — UniqueID prepends `data-` automatically), `types: ['heading', 'hyperlink', 'table']`. **Decision made:** UniqueID is the single ID source; TableOfContents' ID-stamping `appendTransaction` must be disabled (see Phase 1).
5. **`@floating-ui/dom`** — required by HeadingDrag for handle positioning. Check if already in `package.json`; add if missing.
6. **Yjs document reset** — existing Yjs docs have nested schema. Fresh start (dev/test data only). Hocuspocus stored Y.Docs must be cleared.
7. **Coordinated deployment** — all connected clients must run new schema simultaneously. Forward-only deploy.

## Risk Analysis

| Risk                                                            | Likelihood | Impact | Mitigation                                                                                                                          |
| --------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Vendored extensions don't compile with project's TipTap version | Low        | High   | Phase 0 verification; docs-plus/editor uses `^3.20.4`, project uses `^3.20.0` — compatible                                          |
| `computeSection()` perf degrades with large docs                | Medium     | Medium | Release QA profiling; cache in plugin state if needed                                                                               |
| HeadingFold cursor gaps (mouse/programmatic)                    | Medium     | Medium | **Accepted for v1** — keyboard guard only (ArrowUp/Down). Follow-up issue for `appendTransaction` cursor correction post-migration. |
| Decoration mapping fails under heavy collab                     | Low        | High   | `canMapDecorations` fallback + y-sync$ guard (Phase 1) + Release QA stress test                                                     |
| UniqueID collisions in collaboration                            | Low        | Medium | Yjs conflict resolution + Release QA verification                                                                                   |
| Missed file referencing nested schema                           | Medium     | Low    | Post-Phase 5 global grep (see checklist below)                                                                                      |
| URL deep-linking regression                                     | Medium     | Medium | Phase 5 preserves path-based URL scheme; HeadingFilter uses query params — need adapter                                             |
| TableOfContents + Yjs extra mutations                           | Medium     | Medium | ToC 3.20.0 has no `y-sync$` guard; test with Hocuspocus; wrap or disable if flicker                                                 |
| UniqueID + TableOfContents attribute conflict                   | Medium     | High   | Resolved: UniqueID is single source; disable ToC's ID stamping in Phase 1. Test that ToC reads but doesn't write.                   |

## Deployment Runbook

This is a **forward-only deploy**. No mixed-schema collaboration is possible.

1. **Announce maintenance window** — all editors must close
2. **Clear Yjs persistence** — wipe Hocuspocus Y.Doc storage (or use new namespace)
3. **Deploy server** — Hocuspocus + webapp simultaneously
4. **Clear client caches** — ensure no stale bundles (CDN cache bust)
5. **Verify** — open two tabs, test heading operations, fold, drag, collaboration
6. **If rollback needed** — restore previous server + clear Yjs again (data created under new schema is not backward-compatible)

**Fold state (localStorage):** HeadingFold persists fold state to `localStorage` under key `editor-folds-{documentId}` (renamed from `tinydocy-folds-` in Phase 1, with one-time migration). On first load after migration, old fold keys are migrated to the new key name, then `pruneStaleIds()` removes entries for headings that no longer exist. The old IndexedDB (`headingCrinkleDB`) is no longer used and can be deleted from client storage via a one-time cleanup or left to expire.

## Success Metrics

- [ ] Editor boots and handles all heading operations (create, toggle, fold, drag, filter, scale) with zero console errors
- [ ] All remaining Cypress tests pass (formatting, lists, rewritten heading/keyboard tests)
- [ ] Collaboration works with 2+ simultaneous editors (fold, unfold, edit within folded sections)
- [ ] TOC renders, drags, and context-menu actions work
- [ ] Chatroom heading integration works (copy-to-doc, reply-in-thread, breadcrumb)
- [ ] Performance: no perceptible jank with 500+ headings. Profile and optimize if typing latency exceeds frame budget.
- [ ] Net code deletion: ~4000+ lines removed
- [ ] Full-doc paste (⌘A→⌘V) works correctly

## Global Attribute Rename Checklist

After all phases, verify zero remaining references to old patterns:

```bash
rg 'contentHeading|CONTENT_HEADING_TYPE' packages/webapp/src/ --type-add 'web:*.{ts,tsx}'  --type web
rg 'contentWrapper|CONTENT_WRAPPER_TYPE' packages/webapp/src/ --type-add 'web:*.{ts,tsx}' --type web
rg 'wrapBlock' packages/webapp/src/ --type-add 'web:*.{ts,tsx}' --type web
rg '\.heading\[data-id' packages/webapp/src/
rg 'node\.attrs\.id' packages/webapp/src/ --type-add 'web:*.{ts,tsx}' --type web
rg 'normalText' packages/webapp/src/ --type-add 'web:*.{ts,tsx}' --type web
rg 'headingMap' packages/webapp/src/ --type-add 'web:*.{ts,tsx}' --type web
rg 'tinydocy-|--tt-' packages/webapp/src/ --type-add 'web:*.{ts,tsx,scss}' --type web
```

All should return zero matches (excluding comments/docs).

## Estimated Timeline

| Phase                             | Effort   | Cumulative | Notes                                                             |
| --------------------------------- | -------- | ---------- | ----------------------------------------------------------------- |
| Phase 0: Source Extensions        | 1–2 days | 1–2 days   | Import rewrite, attr key patch, moveSection extraction, SCSS copy |
| Phase 1: Schema Swap              | 2–3 days | 3–5 days   | Includes y-sync$ guard, UniqueID/ToC decision                     |
| Phase 2: Toolbar & UI             | 1 day    | 4–6 days   | Can run in parallel with Phase 3                                  |
| Phase 3: HeadingActions           | 1 day    | 4–6 days   | Can run in parallel with Phase 2                                  |
| Phase 4: TOC Rewrite              | 3–4 days | 7–10 days  |                                                                   |
| Phase 5: Chatroom, Filter, Styles | 4–5 days | 11–15 days | Chat/filter/SCSS subsystems can parallelize                       |
| Phase 6: Test Cleanup & New Tests | 2–3 days | 13–18 days | Delete tests incrementally with each phase                        |
| Release QA                        | 1 day    | 14–19 days | Checklist, not a full phase                                       |

**Total: ~3–3.5 weeks** with expert support from ProseMirror and TipTap teams. Phases 2+3 run in parallel; Phase 5 subsystems can parallelize.

## Extension Architecture Quick Reference (from docs-plus/editor)

Key implementation details for reference during coding. **The copied source files are the spec** — this section is a pointer, not a replacement.

| Extension         | Key facts                                                                                                                                                                                                                                                                                                      | Watch out                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **TitleDocument** | `content: 'heading block*'` + `enforceH1Title` appendTransaction + `titlePasteHandler` for full-doc paste                                                                                                                                                                                                      | H1 enforcement is `setNodeMarkup(0, ...)` — runs on all txn sources including Yjs                                                       |
| **HeadingFold**   | State: `foldedIds: Set`, `contentHeights: Map`, `animating: Map`. Three meta types: `toggle`, `set` (bulk/filter), `endAnimation`. Cursor: `handleKeyDown` only (ArrowUp/Down). Persistence: localStorage `editor-folds-{docId}` (renamed in Phase 1 with migration). `pruneStaleIds()` on structural changes. | Cursor from mouse/programmatic/gapcursor is a **v1 known gap** (follow-up). `skipPersist` flag for filter-driven temp folds.            |
| **HeadingScale**  | Rank-based sizing within H1 sections. `--hd-size` CSS custom property via `Decoration.node()`. MAX=20pt, MIN=12pt.                                                                                                                                                                                             | Gate rebuild to heading-level/H1-boundary changes, not every text edit.                                                                 |
| **HeadingDrag**   | `@floating-ui/dom` for handle positioning. Custom mouse events (NOT HTML5 DnD). Section move: insert-first when up, delete-first when down (inline in plugin — extracted to `shared/move-section.ts` in Phase 0).                                                                                              | **No mobile/touch.** Move logic needs extraction for reuse in TOC drag.                                                                 |
| **HeadingFilter** | Commands: `filterPreview`, `commitFilter`, `removeFilter`, `clearFilter`, `setFilterMode`, `applyFilter`. OR/AND + ancestor/descendant expansion. **No independent hiding** — delegates to `HeadingFoldAdapter` for visual filtering via temporary folds. `foldAdapter` is required.                           | **Debounce `filterPreview`** at call site (plugin dispatches immediately per keystroke). URL sync uses query params, not path segments. |
| **Shared**        | `canMapDecorations`: single step, ReplaceStep, same parent, no headings in slice. `computeSection`: linear walk, optional `startChildIndex`. `findAllSections`: skips title H1. `moveSection`: extracted in Phase 0 from HeadingDrag's inline code.                                                            | Add `y-sync$` guard to force full rebuild on remote txns. Patch all `attrs["data-toc-id"]` → `attrs["toc-id"]` for UniqueID config.     |

## References

- **Brainstorm:** `docs/brainstorms/2026-03-24-editor-schema-migration-brainstorm.md`
- **Source repo:** [docs-plus/editor](https://github.com/docs-plus/editor) — HeadingScale, HeadingFold, HeadingDrag, HeadingFilter, TitleDocument, shared utilities
- **TipTap StarterKit:** [tiptap.dev/docs/editor/extensions/functionality/starterkit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
- **TipTap Table of Contents:** `@tiptap/extension-table-of-contents` (MIT, v3.20.3)

### ProseMirror References (from research)

- [Official fold example](https://prosemirror.net/examples/fold/) — decoration + node view + selection correction pattern
- [Node decorations dropped on split](https://discuss.prosemirror.net/t/decorationset-map-with-node-decorations/4152) — Marijn: expected behavior, use full rebuild
- [Efficient decoration updates](https://discuss.prosemirror.net/t/is-there-a-more-efficient-approach-to-updating-decorations-when-the-document-changes-than-scanning-the-entire-document/5992) — "measure before optimizing"
- [Yjs decoration mapping issues](https://github.com/yjs/y-prosemirror/issues/49) — `DecorationSet.map` unreliable for y-sync
- [Yjs DecorationSet remapping](https://discuss.yjs.dev/t/decorationsets-and-remapping-broken-with-y-sync-plugin/845) — full rebuild recommended for y-sync txns
- [UniqueID stability in collab](https://github.com/ueberdosis/tiptap/issues/3974) — historical ID-changing issues
- [StarterKit + Collaboration](https://github.com/ueberdosis/tiptap/issues/6869) — `undoRedo: false` naming
