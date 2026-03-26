# Editor Schema Migration: Nested → Flat

**Date:** 2026-03-24
**Status:** Brainstorm complete — ready for planning

## What We're Building

Replace the current nested heading schema (`heading → contentHeading + contentWrapper`) with a flat document schema (`heading block*`) and decoration-based section behavior, adopting the architecture from [docs-plus/editor](https://github.com/docs-plus/editor).

### Current Architecture (remove)

```
doc (heading+)
  └── heading
        ├── contentHeading (inline-only title)
        └── contentWrapper (body blocks + nested heading*)
```

- Section structure enforced at ProseMirror schema level
- ~25+ custom files: changeHeadingLevel, changeHeadingToParagraphs, wrapContentWithHeading, clipboardPaste, headingMap, validateHeadingHierarchy, copyPastePlugin, hierarchyValidationPlugin, rangeSelectionPlugin, crinklePlugin, HeadingActions, helper files, types, test utils
- 4 custom nodes: Document, Heading, ContentHeading, ContentWrapper
- All keyboard shortcuts, paste, and selection logic deeply coupled to nested structure

### Target Architecture (adopt)

```
doc
  ├── heading (level: 1)   ← enforced title H1
  ├── paragraph
  ├── heading (level: 2)
  ├── paragraph
  └── ...
```

- Flat ProseMirror document — standard `heading` and `block` nodes
- Schema: `heading block*` via `TitleDocument` node
- Section boundaries computed dynamically via `computeSection()`
- Visual behavior via decoration plugins:
  - **HeadingScale** — dynamic font sizing by rank within H1-delimited sections
  - **HeadingFold** — fold/unfold with animated crinkle UI (decoration-based hiding)
  - **HeadingDrag** — drag-and-drop heading sections with floating handle
  - **HeadingFilter** — search/filter headings with OR/AND logic
- Shared utilities: `computeSection`, `matchSection`, `canMapDecorations`
- Uses `@tiptap/starter-kit` (includes default Heading, Paragraph, Text, etc.)

## Why This Approach

1. **Simpler schema = fewer bugs.** The nested structure created a massive surface area for schema violations, paste corruption, and hierarchy edge cases. The flat schema is standard ProseMirror — most operations "just work."

2. **Decoration-based sections are more flexible.** Fold, drag, filter, and scale all work via decorations that don't mutate document structure. No more `contentWrapper` collapse animations that fight with schema validation.

3. **StarterKit compatibility.** Using `@tiptap/starter-kit` means we get keyboard shortcuts, input rules, and paste handling for free instead of reimplementing them.

4. **Clean extension boundaries.** Each extension (fold, drag, filter, scale) is independent and testable. The current codebase has cross-cutting concerns everywhere.

5. **Alignment with docs-plus/editor.** The extensions are already built, tested, and designed for the same product domain.

## Key Decisions

### 1. Branch Strategy

**Branch off main**, surgically remove the heading system, and replace with new extensions. Not starting from scratch — keeping all non-heading infrastructure (collab, media, toolbar, etc.).

### 2. Data Migration

**Fresh start.** Existing Yjs documents have the nested structure and won't be migrated. This is dev/test data only.

### 3. Extension Source

**Copy source files** from docs-plus/editor directly into docsy's codebase. No npm packages or submodules.

### 4. TipTap Version

**Already on v3** (`^3.20.0`). No version upgrade needed — extensions are directly compatible.

### 5. HeadingActions (Chat Affordances)

**Partially adapt, partially delete.** `headingTogglePlugin` → DELETE (replaced by HeadingFold extension). `hoverChatPlugin` + `selectionChatPlugin` → REWRITE to remove `CONTENT_HEADING_TYPE` references and simplify heading detection for flat schema. See per-plugin breakdown in "Scope — Files to Remove".

### 6. Custom Packages

`@docs.plus/extension-hyperlink`, `@docs.plus/extension-hypermultimedia`, `@docs.plus/extension-indent`, `@docs.plus/extension-inline-code` are **independent** of heading structure and should work as-is.

### 7. Heading Levels

**Standard H1-H6.** Drop H7-H10 support.

### 8. UniqueID / TOC ID

**Use StarterKit's default Heading**, configure `UniqueID` to stamp `data-toc-id` on heading nodes (same attribute the new extensions expect). Preserve the existing `generateID` function (`ShortUniqueId().stamp(16)`) and `filterTransaction` (skip Yjs origin transactions). UniqueID must target **all nodes that need stable IDs**: `['heading', 'hyperlink', 'table']` — not just headings.

### 9. CSS Strategy

**Start fresh for heading styles.** 7 SCSS files affected (see detailed file plan in "SCSS" section below):

- **Delete entirely:** `_headings.scss` (172 lines, 100% coupled)
- **Gut heading blocks:** `styles.scss` (~330 lines of heading code out of ~876 total; non-heading code stays)
- **Surgical rewrite:** `_mobile.scss` (~130 lines of heading selectors scattered among mobile layout)
- **Selector updates:** `_blocks.scss` (3 selectors), `_print.scss` (2 rules)
- **Adapt context:** `_heading-actions.scss` (`.title` parent → flat heading context)
- **Monitor:** `_unread-badge.scss` (badge selectors on `.btnOpenChatBox` / `.ha-group` / `.ha-chat-btn` — class names stay, parent context changes)
- Also remove `@use './headings'` from `styles.scss` after deleting the file.

New styles target flat schema elements (`h1`–`h6`, `[data-toc-id]`) + HeadingFold/HeadingScale decoration classes.

### 10. Toolbar Commands

**Standard `toggleHeading({level})`** from StarterKit. No custom `wrapBlock`/`normalText` commands. The toolbar just calls `editor.chain().focus().toggleHeading({ level }).run()`.

### 11. Keyboard Shortcuts

**StarterKit defaults** — `Mod-Alt-{1..6}` + markdown input rules (`#`, `##`, etc.) come built-in. No custom shortcut registration needed.

### 12. Fold UX

**Adopt new HeadingFold as-is** — decoration-based crinkle widget with animated fold/unfold. Customize later if needed.

## Scope — Files to Remove

### Custom Nodes (delete entirely)

- `nodes/ContentHeading.ts`
- `nodes/ContentWrapper.ts`
- `nodes/Heading.ts` (replace with StarterKit default)
- `nodes/Document.ts` (replace with TitleDocument)
- `nodes/Paragraph.ts` (replace with StarterKit default)
- `nodes/Text.ts` (replace with StarterKit default)

### Extensions (delete entirely)

- `extensions/changeHeadingLevel.ts`
- `extensions/changeHeadingLevel-backward.ts`
- `extensions/changeHeadingLevel-forward.ts`
- `extensions/changeHeadingLevel-h1.ts`
- `extensions/changeHeadingToParagraphs.ts`
- `extensions/wrapContentWithHeading.ts`
- `extensions/deleteSelectedRange.ts`
- `extensions/clipboardPaste.ts`
- `extensions/validateHeadingHierarchy.ts`
- `extensions/types.ts`
- `extensions/helper.ts`
- `extensions/helper/clipboard.ts`
- `extensions/helper/headingMap.ts`
- `extensions/helper/nodeState.ts`
- `extensions/helper/selection.ts`
- `extensions/normalText/onHeading.ts`
- `extensions/normalText/onSelection.ts`
- `extensions/testUtils/testSchema.ts`

### Plugins (delete)

- `extensions/plugins/copyPastePlugin.ts`
- `extensions/plugins/hierarchyValidationPlugin.ts`
- `extensions/plugins/rangeSelectionPlugin.ts`
- `extensions/plugins/crinklePlugin.ts`

### Plugins (keep / update)

- `extensions/plugins/decorationHelpers.ts` — **keep** `createDecorationPluginState`/`createDecorationPluginProps` (still used by rewritten hoverChatPlugin for DecorationSet management)
- `extensions/plugins/index.ts` — barrel export re-exports all deleted plugins. **Rewrite** to only export what remains (`decorationHelpers`)

### HeadingActions (per-plugin plan)

- `plugins/headingTogglePlugin.ts` → **DELETE** — replaced entirely by new `HeadingFold` extension. Remove `.heading[data-id]` / `div.contentWrapper` selectors, `toggleHeadingsContent` custom event, IndexedDB fold persistence (HeadingFold handles all of this).
- `plugins/hoverChatPlugin.ts` → **REWRITE** — remove `CONTENT_HEADING_TYPE` tracking (flat schema has no intermediary node). `findHeadingNodes()` simplifies to iterate `heading` nodes directly. `findSelectionHeadingId()` simplifies: `$anchor.parent` IS the heading in flat schema (no ancestor walk). `targetNodeTypes` reduces to `['heading']` only.
- `plugins/selectionChatPlugin.ts` → **REWRITE** — `shouldShow()` check changes from `CONTENT_HEADING_TYPE` to `heading`. `findAncestorOfType()` simplifies since heading is at depth 1 in flat doc.
- `HeadingActionsExtension.ts` → **UPDATE** — remove `headingToggle` option (no longer a plugin here), keep `hoverChat` and `selectionChat`.
- `types.ts` → minor update to `HeadingActionsOptions` (drop `headingToggle`)
- `index.ts` → **UPDATE** barrel export — remove `headingTogglePlugin` re-export

### Unit Tests (delete all 22 files)

All `extensions/__tests__/` files test the nested schema behavior and are coupled to `contentHeading`/`contentWrapper`/`headingMap`/`crinklePlugin`. Delete entirely:

- `changeHeadingLevel.test.ts`, `changeHeadingLevelHandlers.test.ts`
- `validateHeadingHierarchy.test.ts`, `headingStructureValidation.test.ts`
- `crinklePlugin.test.ts`, `hierarchyValidationPlugin.test.ts`
- `copyPastePlugin.test.ts`, `decorationHelpers.test.ts`
- `clipboardRoundTrip.test.ts`, `clipboardSafetyGuards.test.ts`, `clipboardDefensiveInputs.test.ts`
- `handleFullDocumentPaste.test.ts`, `inputRuleAndPastePosition.test.ts`
- `deleteSelectedRange.test.ts`, `schemaAndPluginIntegrity.test.ts`
- `normalTextHelpers.test.ts`, `helperCore.test.ts`
- `buildHeadingTree.test.ts`, `headingMap.performance.test.ts`
- `findPrevBlock.test.ts`, `findPrevBlockE2.test.ts`
- `adjustHeadingLevelsForContext.test.ts`

### Cypress Tests — Delete (deeply coupled to nested schema)

**Heading tests (entire `heading/` directory — ~24 files):**

- `heading/create-heading-simple.cy.js`, `create-heading-complex.cy.js`, `create-heading-complex-part2.cy.js`
- `heading/create-heading-deep-nested.cy.js`, `create-heading-deep-nested-part2.cy.js`
- `heading/keyboard-shortcuts/enter.cy.js`
- `heading/change/heading-level-change-complex.cy.js`, `heading-level-change-coverage.cy.js`, `heading-change-manually.cy.js`
- `heading/change/normal-text/` (4 files), `heading/change/selection/` (4 files)
- Plus untracked: `heading-deep-nesting`, `heading-edge-cases`, `heading-keyboard-shortcuts`, `heading-stress-scale`, `heading-undo-redo`, `heading-wrap-paragraph`, `wrap-paragraph-chain-break`, `README.md`

**Schema tests (entire `schema/` directory):**

- `schema/hn10-validation.cy.js`, `schema/hierarchy-validation-plugin.cy.js`

**Doc schema generator (entire `doc-schema-generator/` directory — 5 files):**

- All generate/validate nested heading structure

**TOC tests:**

- `toc/toc-complex-structure.cy.js`, `toc/toc-drag-drop.cy.js`

**Copy-paste tests (all test nested heading paste — 15+ files):**

- `copy-paste/stack-attach-deep-nesting.cy.js`, `schema-validation-paste.cy.js`, `critical-schema-test.cy.js`
- `copy-paste/level-adjustment-paste.cy.js`, `select-all-paste-clipboard.cy.js`, `clipboard-validation.cy.js`
- `copy-paste/internal-copy-paste.cy.js`, `external-paste.cy.js`, `node-boundary-paste.cy.js`
- `copy-paste/cut-operations.cy.js`, `complex-cut-paste.cy.js`, `undo-redo.cy.js`
- `copy-paste/native-list-clipboard-headed-smoke.cy.js`, `native-external-clipboard-smoke.cy.js`
- Plus untracked: `paste-preserves-sibling-levels.cy.js`

**Edge cases:** `edge-cases/multi-section-edge-cases.cy.js`, `bug-fixes-edge-cases.cy.js`

**Manual browser tests:** `manual-browser-test/` (3 files) — all test nested paste

**Cypress command tests:** `cypress-commands/validate-dom-structure-*.cy.js` (3 files), `create-selection.cy.js`

### Cypress Tests — Rewrite (need flat schema setup)

- `user-behavior/keyboard-shortcuts.cy.js`, `toolbar-shortcut-parity.cy.js`, `editing-flows.cy.js`
- `keyboard-action-flow/select-all-and-empty-doc.cy.js`

### Cypress Tests — Keep (schema-agnostic core logic, but need updated test setup)

- `formatting/` (7 files: bold, italic, underline, strike, highlight, combined, extended-marks)
- `lists/` (7 files: bullet, ordered, task, combined, edge-cases, clipboard-combinations, alignment)

**Note:** even "keep" tests depend on `cypress/support/commands.ts` which has nested-schema commands. These will fail until `commands.ts` is rewritten.

### Cypress Support Infrastructure (rewrite/delete)

- `cypress/support/commands.ts` — massive (1500+ lines). Contains `createHeading`, `createIndentHeading`, `putPosCaretInHeading` (uses `contentHeading` node type), `applyHeadingLevelChange`, `validateHeadingLevelChange`, `moveHeading` (via `window._moveHeading`), document structure validators with `.contentWrapper` selectors. **Must rewrite** for flat schema.
- `cypress/support/schemaValidator.js` — validates nested heading hierarchy (depth checks, H1-only at root). **Delete** — flat schema doesn't have nesting depth rules.
- `cypress/support/domSchemaValidator.js` — validates `.contentWrapper` nesting, parent heading levels. **Delete**.
- `cypress/support/heading-test-helpers.js` — (untracked). **Delete or rewrite**.
- `cypress/fixtures/cypress-commands/validateDomStructure/` — 3 HTML fixtures with nested heading DOM. **Delete**.
- `cypress/fixtures/cypress-commands/createSelection/` — 7 HTML fixtures with nested heading structure. **Rewrite** for flat schema.
- `cypress/fixtures/minimax-article.html` — nested heading HTML. **Rewrite** or delete.

## Scope — Files to Add

### New Extensions (copy from docs-plus/editor)

- `extensions/title-document/` — TitleDocument node
- `extensions/heading-scale/` — HeadingScale decoration plugin
- `extensions/heading-fold/` — HeadingFold + animated crinkle
- `extensions/heading-drag/` — HeadingDrag with floating handle
- `extensions/heading-filter/` — HeadingFilter with OR/AND
- `extensions/shared/` — computeSection, matchSection, canMapDecorations

## Scope — Files to Modify

### Editor Setup

- `TipTap.tsx` — swap extensions list, use StarterKit, add new extensions

### Toolbar (Desktop + Mobile)

**`toolbar/StyleSelect.tsx`** (Desktop heading picker) — **Rewrite.** Currently H1–H10 with old commands:

- `BLOCK_STYLES` array: truncate from H1–H10 → **H1–H6**
- Loop `for (let i = 1; i <= 10; i++)` → `i <= 6`
- `editor.isActive('contentHeading', { level: i })` → `editor.isActive('heading', { level: i })`
- `normalText()` → `setParagraph()`
- `wrapBlock({ level })` → `toggleHeading({ level })`
- Tooltip shortcut `⌘+⌥+[0-9]` → `⌘+⌥+[0-6]`

**`toolbarMobile/HeadingSelection.tsx`** (Mobile heading +/- stepper) — **Rewrite.** Heavily coupled to old schema:

- DOM traversal `domNode?.parentElement?.closest('.heading')?.getAttribute('level')` → **detect heading level** from flat `<h1>`–`<h6>` elements (e.g. `domNode?.closest('h1,h2,h3,h4,h5,h6')?.tagName`)
- `isActive('contentHeading', { level: i })` → `isActive('heading', { level: i })`
- Level loop/bounds: `i <= 9` / `headingLevel < 9` → **cap at 6**
- Magic offset guard `$anchor.pos - $anchor.parentOffset === 2` → **rewrite** for TitleDocument's H1 protection (first heading in doc)
- `wrapBlock({ level })` → `toggleHeading({ level })`
- `normalText()` → `setParagraph()`

**`toolbar/toolbarUtils.ts`** — **Update.** Two heading-coupled utility functions:

- `searchThroughHeading()`: `document.querySelectorAll('.title')` → query `'h1, h2, h3, h4, h5, h6'` or `'[data-toc-id]'`
- `highlightTocHeadings()`: `heading.closest('.heading')?.getAttribute('data-id')` → `heading.getAttribute('data-toc-id')` (flat headings have the attribute directly)

**`toolbar/FilterModal.tsx`** — **No direct changes.** Depends on `toolbarUtils.ts` rewrites above (imports `searchThroughHeading`, `highlightTocHeadings`, `applySearchThroughHeading`).

**No changes needed:**

- `toolbar/EditorToolbar.tsx` — renders `<StyleSelect>`, no direct heading code
- `toolbar/GearModal.tsx` — document metadata / read-only only; **removed** `indentHeading` / `h1SectionBreak` page preferences (flat schema; styling lives in vendored heading SCSS)
- `toolbarMobile/ToolbarMobile.tsx` — renders `<HeadingSelection>`, no direct heading code
- `toolbarMobile/FormatSelection.tsx` — pure formatting (bold, italic, lists, clear), no heading code
- `toolbar/ToolbarButton.tsx`, `Icon.tsx`, `InsertMultimediaForm.tsx`, `BookmarkModal.tsx`, `FilterPanelSkeleton.tsx`, `GearPanelSkeleton.tsx` — no heading code

### Types

- `types/tiptap.ts` — remove `heading.normalText`, `heading.wrapBlock` command augmentations; remove `CONTENT_HEADING_TYPE`, `CONTENT_WRAPPER_TYPE` from `TIPTAP_NODES` enum; remove `TRANSACTION_META` entries for fold/heading-specific events (fold state is now plugin-driven)

### TOC — Major Rewrite Required

The entire `components/toc/` directory (23 files) is deeply coupled to the nested schema:

**Must rewrite/replace:**

- `hooks/useToc.ts` — walks `contentHeading` nodes, reads fold from `getNodeState()` (localStorage). Replace with `@tiptap/extension-table-of-contents` data + `headingFoldPluginKey` state.
- `hooks/useTocDrag.ts` (630 lines) — all drag logic uses nested structure: `processHeadingForLevelChange` manipulates `contentHeading`/`contentWrapper` JSON, `contentEnd = nodeSize - 2` math, STACK-ATTACH parent walks nested tree. Replace with `findAllSections()` + `computeSection()` + flat `moveSection()` utility (~50 lines).
- `utils/moveHeading.ts` — duplicate of drag logic for tests. Replace with shared `moveSection`.
- `hooks/useTocActions.tsx` — DOM selectors `.heading[data-id]`, `.heading[data-id] .title`, ResolvedPos path traversal for heading type. Rewrite for flat selectors.
- `dnd/` utilities — flattenTocItems, getDescendantCount, getDescendantIds, pointer collision. Most of this simplifies dramatically with flat schema.

**Can likely adapt:**

- `hooks/useActiveHeading.ts` — scroll spy, may be replaceable by `@tiptap/extension-table-of-contents`
- `hooks/useHeadingScrollSpy.ts` — uses `.heading[data-id]` selector (line 60) — update to `[data-toc-id]`
- `hooks/usePresentUsers.ts` — collaboration-related, schema-agnostic
- `hooks/useUnreadCount.ts` — chat-related, schema-agnostic
- `TocDesktop.tsx`, `TocMobile.tsx`, `TocItemDesktop.tsx`, `TocItemMobile.tsx` — UI components that consume TOC data; DOM selectors need updating but structure is adaptable
- `TocContextMenu.tsx`, `TocHeader.tsx` — UI, mostly schema-agnostic

**Reference:** docs-plus/editor's `toc-sidebar.tsx` is a single clean component using `TableOfContentData` + `computeSection` + `moveSection`.

### App-Level Code (outside TipTap) — Schema-Coupled Files

These files reference `contentHeading`, `contentWrapper`, `.wrapBlock`, or nested heading JSON and need rewriting:

1. **`hooks/useApplyFilters.ts`** — uses `.heading .title`, `.wrapBlock`, IndexedDB fold storage. **Replace entirely** with `HeadingFilter` extension commands (the new `HeadingFilter` does this via ProseMirror state, not DOM).

2. **`hooks/helpers/filterLogic.ts`** — builds tree from DOM headings (`.wrapBlock` selectors). **Delete** — replaced by `HeadingFilter` plugin's `filterSections()` / `matchSections()`.

3. **`components/pages/document/components/AppendHeadingButton.tsx`** — builds nested JSON (`contentHeading` + `contentWrapper`). **Simplify** to insert flat `{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }`.

4. **`components/pages/editor/helpers/createDocumentFromStructure.ts`** — generates nested heading JSON for document seeding. **Simplify** to flat `heading` + `paragraph` + `heading` sequence.

5. **`components/chatroom/MessageCard/hooks/useCopyMessageToDocHandler.ts`** — navigates `headingContentNode.nodeSize + 2` to find `contentWrapper` insert position. **Rewrite** to use `computeSection()` for position calculation in flat doc.

6. **`components/chatroom/MessageCard/hooks/useReplyInThreadHandler.ts`** — creates nested `createHeadingNodeJson` (contentHeading + contentWrapper JSON), inserts at `headingPos + content.size`. **Rewrite** to flat heading JSON + insert at `computeSection().to`.

7. **`components/pages/document/components/toolbarMobile/HeadingSelection.tsx`** — (see Toolbar section above for full rewrite details)

### Events

- `services/eventsHub.ts` — update DOM selectors (no more `.wrapBlock[data-id]`)

### SCSS (rewrite heading styles)

**`styles/styles.scss`** — ~330 lines of heading-coupled code (lines 12–342). **Gut and replace.**

- Lines 12–13: `$crinkle-time` / `$crinkle-transition` variables (heading-only) — **delete**
- Lines 15–76: entire `.foldWrapper` block (fold UI, skew pseudo-elements) — **delete**
- Lines 104–254: `div.heading` block — all `closed`/`closing`/`opening`/`opened` states, `@keyframes foldCrinkle_*` / `unfoldCrinkle_*` / `unfoldWrapper`, all `.wrapBlock > .foldWrapper` / `.wrapBlock > .contentWrapper` rules — **delete**
- Lines 256–258: `.heading:hover > .title .btnOpenChatBox` — **delete**
- Lines 260–342: entire `.wrapBlock` block (`.title`, `.foldWrapper`, `.contentWrapper`, `.btnOpenChatBox`) — **delete**
- Lines 344+: non-heading (modals, hyperlink popovers, dropdown-menu, media toolbar) — **keep untouched**

**`styles/_headings.scss`** — 172 lines, 100% heading-coupled. **DELETE entire file** (replaced by minimal project rules + vendored heading SCSS).

- ~~`body.indentHeading` / `body.h1SectionBreak`~~ — **removed** (no longer used)
- `div.heading`, `.title::before`, `.foldWrapper`, `.fold`, `.contentWrapper`
- `.heading[level='1']` border/padding rules
- `.heading-container`, `.btnOpenChatBox`
- Mobile media query with `.heading` selectors
- New replacement styles will be written for flat schema + HeadingFold/HeadingScale decoration classes

**`styles/_mobile.scss`** — ~130 lines of heading-coupled code scattered throughout. **Surgical rewrite.**

- Lines 136–137: `.heading`, `.contentWrapper` in caret-color list — **update** to `h1, h2, h3, h4, h5, h6`
- Lines 147–150: `.heading[level='1']` border override — **update** to `h1`
- Lines 153–238: `.title` block with `.ha-wrap`, `.ha-single.btnOpenChatBox` — **adapt** for flat schema heading action positioning
- Lines 242–247: `.heading-content` user-select — **evaluate** if still needed
- Lines 249–263: `div.heading` with `.foldWrapper .fold`, `.wrapBlock > .foldWrapper .fold` — **delete** (HeadingFold handles this)
- Lines 306–326: `.headingSelection` class — **keep** (toolbar UI, not schema-coupled)

**`styles/_blocks.scss`** — 3 heading selectors across distinct blocks. **Update selectors.**

- Line 39: `.heading[level='1']` background-color — **update** to `h1` or `h1[data-toc-id]`
- Lines 93–94: `.heading`, `.contentWrapper` in caret-color rule — **update** to `h1, h2, h3, h4, h5, h6`
- Line 118: `.heading[level='1']` in explicit caret-color — **update** to `h1`

**`styles/_print.scss`** — 2 heading rules. **Update selectors.**

- Lines 50–55: `.heading` (border, background, margin, padding) — **update** to `:is(h1, h2, h3, h4, h5, h6)`
- Lines 57–60: `.heading[level='1']`, `.heading[level='1']:first-of-type` — **update** to `h1`, `h1:first-of-type`

**`styles/components/_heading-actions.scss`** — 111 lines. **Adapt** alongside HeadingActions plugin rewrite.

- Line 25: `.title` parent selector targets old contentHeading node — **update** context selector for flat schema heading elements
- `.ha-wrap`, `.ha-single`, `.ha-group`, `.ha-chat-btn`, `.ha-comment-btn` positioning rules — **adapt** for new heading action decoration placement

**`styles/components/_unread-badge.scss`** — Badge selectors on heading action elements. **Adapt if parent elements change.**

- Line 58: `.btnOpenChatBox[data-unread-count]` — **keep** (class name stays, context changes)
- Lines 93–99: `.ha-group[data-unread-count]` — **keep** (class name stays)
- Lines 102–114: `.ha-chat-btn[data-unread-count]` — **keep** (class name stays)

**Not heading-coupled (no changes needed):**

- `styles/components/_tableOfContents.scss` — 508 lines of TOC UI styles (targets component classes, not ProseMirror DOM)
- `styles/components/_toolbar.scss` — toolbar layout (no heading selectors)
- `styles/globals.scss` — CSS custom properties and resets
- `styles/_desktop.scss` — desktop layout
- `styles/_chat_editor.scss` — chatroom editor styles
- `styles/_daisyui.scss` — DaisyUI overrides
- `styles/_task-list-placeholder.scss` — task list styles
- `styles/components/_popover.scss`, `_dialog.scss`, `_tooltip.scss` — UI primitives

### Utilities (selector updates)

- `utils/scrollToHeading.ts` — `.heading[data-id="${id}"]` → `[data-toc-id="${id}"]`
- `utils/index.ts` (`getPostAtDOM`) — `.heading[data-id="${id}"]` → `[data-toc-id="${id}"]`

### Database / Stores / Hooks (fold state infrastructure)

- `db/headingCrinkleDB.ts` — IndexedDB (Dexie) for fold/crinkle state persistence. **Keep and adapt** — fold state persistence is user-facing (losing fold positions on reload is a UX regression). Wire HeadingFold's plugin state to read/write this DB, or move persistence into HeadingFold's `onUpdate` handler.
- `hooks/useDocumentMetadata.ts` — imports `headingCrinkleDB`, calls `initDB()`, loads heading map from IndexedDB into localStorage on document load. **Rewrite** to remove heading map loading (no longer needed), keep crinkle DB init for fold persistence.
- ~~`stores/editorPreferences.ts`~~ — **deleted** (only held `indentHeading` / `h1SectionBreak`; both features removed post-migration).
- `stores/focusedHeadingStore.ts` — Zustand store for focused heading ID in TOC. Schema-agnostic (just stores an ID string). **Keep as-is.**
- `hooks/useCheckUrlAndOpenHeadingChat.ts` — reads `open_heading_chat` URL param, publishes `CHAT_OPEN`. Schema-agnostic. **Keep as-is.**
- `toolbar/GearModal.tsx` — **no** heading-indent / H1 section-break toggles (removed with `editorPreferences`).

### Editor Page (test infrastructure)

- `pages/editor.tsx` — exposes `window._moveHeading` (uses `moveHeadingById` from nested schema) and `window._createDocumentFromStructure` (uses nested JSON builder). **Rewrite** both to use flat-schema equivalents (`moveSection`, flat JSON).
- `components/pages/editor/Controllers.tsx` — exposes `_editorSelect`, `_editorSelectAndCopy`, `_editorSelectElement` for Cypress. The actual selection logic lives in `useHierarchicalSelection`.
- `components/pages/editor/hooks/useHierarchicalSelection.ts` — `selectHierarchical('section')` uses `.heading[level="1"]`, `selectHierarchical('heading')` uses `.heading`. **Rewrite** for flat schema selectors (`h1`, `h2`, etc., or `[data-toc-id]`).

### Subsystem Decisions (Filter, TOC, DnD, Chatroom)

### 13. Filter — URL Scheme

**Keep path-based URLs.** Docsy uses `/doc-slug/heading-slug-1/heading-slug-2` for deep-linking. Adapt `HeadingFilter`'s URL sync (`updateFilterUrl` / `readFilterUrl`) to produce path segments instead of `?filter=...&mode=...` query params.

### 14. Filter — Algorithm

**Port the weighted classification algorithm** from current DOM-based `filterLogic.ts` to operate on ProseMirror document state. The current algorithm has parent/child slug classification with DFS and weight-based sorting that the new `matchSections`/`filterSections` doesn't replicate. Rewrite `filterLogic.ts` to walk ProseMirror nodes (via `findAllSections` + `computeSection`) instead of DOM elements (`.heading .title`, `.wrapBlock`).

### 15. Filter — UI

**Both.** Adopt the `FilterBar` component (search input, tag pills, OR/AND toggle, match counter) for interactive filtering, plus keep URL-based deep-linking for navigation. On page load: read slugs from URL path → call `editor.commands.applyFilter(slugs, mode)`. On filter change: update URL path.

### 16. TOC

**Adopt docs-plus/editor's `toc-sidebar` as reference**, adapt for docsy's UI (desktop/mobile split, context menu, chat integration). Use `@tiptap/extension-table-of-contents` for data, `computeSection` + `moveSection` for drag.

### 17. TOC Context Menu

**Adapt in-place.** Most actions are ID-based (chat, fold toggle) and need minimal changes. Key adaptations:

- Delete section: replace `$pos.depth` traversal with `computeSection(doc, pos, level)` → `tr.delete(from, to)`
- Link section: simplify heading path building (flat doc, heading is top-level)
- DOM selectors: `.heading[data-id]` → `[data-toc-id]`
- Insert actions: implement fresh (currently TODOs)

### 18. TOC Utilities

- `scrollToHeading` — update DOM selector and URL path building for flat structure
- `scrollToDocTitle` — trivial selector update
- `buildNestedToc` — schema-agnostic, keep as-is

### 19. DnD (Drag & Drop)

**Keep the current DnD UX and UI components.** The `dnd/` folder is schema-agnostic (types, modifiers, collision detection, indicator portal, flatten/descendant utilities — all work on `TocItem` data and DOM rects). Only `useTocDrag.ts` needs its ProseMirror transaction logic rewritten:

- `processHeadingForLevelChange` → `tr.setNodeMarkup(pos, null, { level: newLevel })`
- `calculateInsertPos` (130 lines of STACK-ATTACH) → `computeSection` + simple before/after (~10 lines)
- Transaction execution → `moveSection(view, from, to, targetPos, newLevel)`
- `findHeadingById` / `getAllHeadings` → `findAllSections()` from shared utilities
- `moveHeading.ts` (test duplicate) → reuse shared `moveSection`

### 20. Chatroom Integration

**Mostly ID-based — minimal impact.** ~15 chatroom files use `headingId` as an opaque channel ID — no change needed.

**Action menu items (10 total, only 2 touch schema):**

- `useCopyMessageToDocHandler.ts` — rewrite position math: `computeSection(doc, pos, level)` → insert at section body (after heading, before next heading). Remove `contentWrapper`/`firstChild`/`lastChild` + magic `+2`.
- `useReplyInThreadHandler.ts` — replace `createHeadingNodeJson` (nested: contentHeading + contentWrapper) with flat: `{ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }` + paragraphs after. Insert at `computeSection().to`.
- Other 8 actions (reply, emoji, copy link, bookmark, pin, edit, delete, forward) — no schema dependency.

**Breadcrumb (critical structural change):**

- `Breadcrumb.tsx` + `BreadcrumbMobile.tsx` — `nodePos.path` filtering for heading ancestors **only works with nested schema**. In flat doc, `resolve(pos).path` is just `[doc, heading]`. Must rewrite to walk backward through top-level children, collecting nearest heading at each lower level.
- `x.firstChild.textContent` → `x.textContent` (no contentHeading intermediary in flat schema).

**Other:**

- `eventsHub.ts` UNREAD_SYNC — drop `.wrapBlock[data-id]` selectors
- `getPostAtDOM` utility — selector `.heading[data-id]` → `[data-toc-id]`
- Attribute renames (`x.attrs.id` → `x.attrs['data-toc-id']`) — see Decision 21

### 21. DOM Selectors & Node Attributes (Global Change)

**CSS/DOM selectors:** All code using `.heading[data-id="..."]` and `.heading[data-id="..."] .title` needs updating. In the flat schema, headings are standard `<h1>`–`<h6>` elements with `data-toc-id` from UniqueID. New selector: `[data-toc-id="${id}"]`.

**ProseMirror node attributes:** All code accessing `node.attrs.id` on heading nodes must change to `node.attrs['data-toc-id']`. This affects TOC hooks, chatroom handlers, event hub, breadcrumb, and any utility that reads heading identity from ProseMirror state (not just DOM).

## Open Questions

None — all resolved.

- ~~`@tiptap/extension-table-of-contents`~~ — **Open-source MIT** (v3.20.3, March 2026). Available as `@tiptap/extension-table-of-contents`. Add to `package.json`.
- ~~`@tiptap/extension-unique-id`~~ — **Already a dependency** (`^3.20.0` in `packages/webapp/package.json`). Open-source MIT. Currently configured with `types: ['heading', 'hyperlink']` + custom `generateID` (`ShortUniqueId().stamp(16)`). Add `'table'` to types, set `attributeName: 'data-toc-id'`.

## Dependencies / Risks

1. **StarterKit bundling** — Need to add `@tiptap/starter-kit` and `@tiptap/extension-table-of-contents` deps. Disable `document` in StarterKit (using TitleDocument instead). `@tiptap/extension-unique-id` already installed — configure `attributeName: 'data-toc-id', types: ['heading', 'hyperlink', 'table']`, keep existing `generateID` (`ShortUniqueId().stamp(16)`) and `filterTransaction`. StarterKit's Heading does NOT need to be disabled or replaced.

2. **Collaboration compat** — Yjs collaboration works at the Y.Doc level, so the flat schema is structurally compatible. However: all connected clients must run the new schema simultaneously — no mixed-schema collaboration is possible. Since Decision 2 is "fresh start," this is handled by clearing Yjs persistence, but **staging/production deployments must be coordinated** (all clients update at once).

3. **SCSS/CSS** — 7 files affected, ~630 lines of heading-coupled SCSS across `styles.scss` (~330 lines), `_headings.scss` (172 lines, delete entirely), `_mobile.scss` (~130 lines), `_blocks.scss`, `_print.scss`, `_heading-actions.scss`, `_unread-badge.scss`. The new architecture uses flat selectors (`h1`–`h6`, `[data-toc-id]`) and HeadingFold/HeadingScale decoration classes instead of `.contentHeading`, `.contentWrapper`, `.wrapBlock`.

4. **Package consolidation** — Many individual `@tiptap/extension-*` packages can be replaced by `@tiptap/starter-kit`. Should clean up `package.json`.

## ProseMirror Behavioral Concerns

These are runtime behaviors that the brainstorm's file-level inventory doesn't cover. They must be verified or implemented during migration:

### Title H1 Enforcement

The `TitleDocument` schema (`content: 'heading block*'`) ensures a heading node is always the first child, but it doesn't enforce **level 1** specifically. A user could change the title to H3 and the schema would accept it. The docs-plus/editor's `TitleDocument` likely includes `appendTransaction` logic to force `level: 1` on the first heading. **Verify this exists in the copied source, or add it.**

### Cursor Behavior in Folded Content

When HeadingFold hides nodes via `display: none` decorations, ProseMirror's cursor can still land in hidden content via:

- Arrow key navigation
- Gapcursor extension
- `setTextSelection()` calls
- Click events on the editor boundary

The HeadingFold plugin must handle this — either via `filterTransaction` (redirecting cursor out of folded regions) or by adjusting `createSelectionBetween`. **Verify the docs-plus/editor HeadingFold handles this.**

### Selection Across Folded Sections

When a user selects text that spans a folded section, the selection includes the hidden nodes (ProseMirror selections are position-based, not visual). Operations on this selection (delete, format, copy) will affect hidden content. This may be intentional, but it should be tested and documented.

### Decoration Mapping Under Collaboration

All four decoration plugins (scale, fold, drag, filter) create `DecorationSet` objects that must be mapped across incoming Yjs steps. The `canMapDecorations` utility from docs-plus/editor handles the common case, but large remote transactions can invalidate entire decoration sets. Each plugin must fall back to full recomputation when mapping fails. **Test with concurrent editing in folded/filtered state.**

### `computeSection()` Edge Cases

The flat schema relies on `computeSection()` for all position math. Verify it handles:

- **End of document** — last heading with no trailing content
- **Consecutive headings** — H2 followed immediately by H3 (empty section)
- **Skipped levels** — H1 → H4 (no H2/H3 in between)
- **Single heading document** — just the title H1, no other content

### `computeSection()` Performance at Scale

The nested schema computed section boundaries "for free" (structural). The flat schema computes them dynamically via doc traversal. For documents with 500+ headings, `computeSection()` is called on every transaction by multiple decoration plugins (fold, scale, potentially drag/filter). **Profile with large documents.** If needed, cache section data in plugin state and only recompute on structural changes.

### UniqueID Stability in Collaboration

The `UniqueID` extension generates IDs client-side. In collaborative editing, two clients creating headings simultaneously could conflict. UniqueID should rely on Yjs's conflict resolution for the ID attribute. **Verify heading IDs are stable** across collaborative sessions (no duplicate IDs, no ID reassignment on remote merges).
