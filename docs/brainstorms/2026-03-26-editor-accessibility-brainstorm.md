---
date: 2026-03-26
topic: editor-accessibility
---

# Editor Accessibility (WCAG 2.1 AA)

## What We're Building

WCAG 2.1 AA compliance for the TipTap editor and its surrounding UI — keyboard navigation, ARIA roles, focus management, screen reader support, and visible focus indicators. Tiered by impact: keyboard + ARIA first, then screen reader refinements, then full audit coverage.

The editor currently has almost no accessibility support. No ARIA roles on the editor surface or toolbar, no keyboard navigation for the toolbar, no focus rings, no skip-to-content link, and minimal `aria-label` usage.

## Why This Approach

**Approach chosen:** Tiered by impact — fix the biggest gaps first, then expand.

**Approaches considered:**

| Approach                     | Verdict                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| A. Tiered by impact (chosen) | Shippable increments, biggest UX improvement first            |
| B. WCAG audit first          | Audit takes days before any code ships; many findings trivial |
| C. Outsource audit           | External dependency and cost; still need dev work after       |

**Why A wins:** The gaps are well-understood from codebase research. The biggest failures (no keyboard toolbar access, no ARIA, no focus rings) don't need an audit to identify — they're objectively missing. Ship those first, then consider a formal audit for edge cases.

## Tier 1 — Keyboard + ARIA Essentials

### 1.1 Editor surface ARIA

Add `role="textbox"`, `aria-multiline="true"`, and `aria-label="Document editor"` to `editorProps.attributes` in `TipTap.tsx`. TipTap v3 recent PRs (#5734, #5758) may add some of this — check if upgrading gives it for free.

### 1.2 Toolbar keyboard navigation (WAI-ARIA Toolbar pattern)

- Add `role="toolbar"` and `aria-label="Formatting"` to the toolbar container in `EditorToolbar.tsx`
- Implement roving `tabindex` — one tab stop into the toolbar, Left/Right arrow keys between buttons
- Add `Alt+F10` from editor to focus toolbar (TipTap's recommended pattern)
- `Escape` from toolbar returns focus to editor
- Reference: [WAI-ARIA Toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)

### 1.3 `aria-label` on icon-only buttons

Audit all icon-only buttons in the toolbar and add `aria-label`. Current tooltips are hover-only — not exposed to screen readers. The `Button` component likely needs an `aria-label` prop plumbed through.

### 1.4 Visible focus indicators

- Remove blanket `outline: none` from `.ProseMirror` and toolbar elements
- Add `:focus-visible` styles with a visible focus ring (e.g., `ring-2 ring-primary`) that respects the design system
- Affected files: `globals.scss`, `_blocks.scss`, `styles.scss`, `ToolbarButton.tsx`

### 1.5 DocTitle accessibility

Add `role="textbox"`, `aria-label="Document title"` to the contentEditable title element in `DocTitle.tsx`.

## Tier 2 — Screen Reader Refinements

### 2.1 VoiceOver block element fix

Add `::after { content: '\200B' }` (zero-width space) to all block elements in the editor (`h1`–`h6`, `p`, `li`, `blockquote`, etc.) per TipTap's official recommendation. Currently only applied to `.mention`.

### 2.2 TOC keyboard navigation

- Replace `<span onClick>` chat trigger in `TocItemDesktop.tsx` with a proper `<button>`
- Add `aria-label` to desktop fold controls (mobile already has this)
- Add roving `tabindex` or `role="tree"` / `treeitem` to the TOC heading list

### 2.3 Dialog/Popover ARIA fixes

- Fix `ModalContent` where `aria-labelledby` and `aria-describedby` both point to the same element — they should reference different elements (title vs description)
- Verify non-modal Popover focus behavior for keyboard users

### 2.4 Skip-to-content link

Add a visually hidden "Skip to editor" link that appears on focus, jumping past the header/toolbar to the editor content.

## Tier 3 — Full WCAG 2.1 AA Coverage

### 3.1 axe-core integration

Add `@axe-core/react` (dev only) or `cypress-axe` to catch regressions. Run as part of CI on key editor pages.

### 3.2 Contrast audit

Verify all editor UI meets WCAG 2.1 AA contrast ratios (4.5:1 text, 3:1 UI components). The design system likely handles most of this, but custom editor elements (fold chevrons, drag handles, placeholder text) need verification.

### 3.3 Heading fold keyboard access

Expose fold/unfold via keyboard — either a keyboard shortcut or focusable toggle in the heading gutter. Arrow key navigation across folded regions already works.

### 3.4 Collaboration cursor announcements

Verify that collaboration cursors/carets don't create screen reader noise. The DOM-based cursor rendering may need `aria-hidden="true"` to avoid announcing random user labels during editing.

## What NOT to Do

- **Don't pursue ATAG 2.0** — WCAG 2.1 AA is the standard target for web apps. ATAG is for dedicated authoring tool products and adds significant scope.
- **Don't build custom screen reader announcements** for every editor action — TipTap/ProseMirror's `contenteditable` handles basic editing announcements natively.
- **Don't refactor the toolbar architecture** — add ARIA and roving tabindex to the existing structure.

## Scope of Changes

| Tier | Files                                                              | Effort                                 |
| ---- | ------------------------------------------------------------------ | -------------------------------------- |
| 1.1  | `TipTap.tsx`                                                       | Small — add attributes                 |
| 1.2  | `EditorToolbar.tsx` + toolbar components                           | Medium — roving tabindex + keybindings |
| 1.3  | All icon-only `Button`/`ToolbarButton` uses                        | Small — add aria-labels                |
| 1.4  | `globals.scss`, `_blocks.scss`, `styles.scss`, `ToolbarButton.tsx` | Small — CSS changes                    |
| 1.5  | `DocTitle.tsx`                                                     | Small — add attributes                 |
| 2.1  | `styles.scss` or `globals.scss`                                    | Small — CSS rule                       |
| 2.2  | `TocItemDesktop.tsx`, TOC components                               | Medium — element + keyboard changes    |
| 2.3  | `Dialog.tsx`                                                       | Small — fix aria refs                  |
| 2.4  | Layout component (`PadTitle.tsx` or document layout)               | Small — hidden link                    |
| 3.1  | Test config / CI                                                   | Medium — setup + baseline              |
| 3.2  | Design system audit                                                | Evaluation                             |
| 3.3  | `heading-fold` extension                                           | Small — add shortcut or toggle         |
| 3.4  | `TipTap.tsx` (caret render)                                        | Small — add aria-hidden                |

## Research Sources

- [TipTap — Accessibility guide](https://tiptap.dev/docs/guides/accessibility)
- [TipTap #1046 — A11y umbrella issue](https://github.com/ueberdosis/tiptap/issues/1046)
- [TipTap #5734 — Editor surface role/label](https://github.com/ueberdosis/tiptap/pull/5734)
- [TipTap #5235 — aria-label for lists](https://github.com/ueberdosis/tiptap/issues/5235)
- [ProseMirror discuss — Enabling accessibility](https://discuss.prosemirror.net/t/enabling-accessibility-on-prosemirror/3147)
- [WAI-ARIA Toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WCAG 2.1 — Keyboard Accessible](https://www.w3.org/WAI/WCAG21/Understanding/keyboard-accessible)
- [WCAG 2.1 — Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value)
- [WCAG 2.1 — No Keyboard Trap](https://www.w3.org/TR/WCAG21/#no-keyboard-trap)

## Next Steps

→ `/workflows:plan` for implementation details (start with Tier 1)
