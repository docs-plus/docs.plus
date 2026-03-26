---
title: 'feat: Editor Markdown Support'
type: feat
status: completed
date: 2026-03-26
brainstorm: docs/brainstorms/2026-03-26-editor-markdown-support-brainstorm.md
---

# feat: Editor Markdown Support

## Overview

Add bidirectional Markdown support to the TipTap editor via `@tiptap/markdown`. Users can paste Markdown text (auto-detected) and export documents as `.md` files. Storage remains Yjs/JSON — Markdown is an export/paste layer only.

## Problem Statement

The editor has no Markdown integration. StarterKit provides input rules (`#` → heading, `**` → bold) but no Markdown parsing or serialization. Users copying content from GitHub, Notion, or `.md` files get raw text instead of rich content. There is no way to export a document as Markdown.

## Proposed Solution

Install `@tiptap/markdown` (first-party, Marked-based). Wire it into the editor config. Add `parseMarkdown`/`renderMarkdown` hooks to custom extensions. Build a paste detection plugin and export download action.

## Technical Approach

### Clipboard Strategy

**When both `text/html` and `text/plain` exist:** Let TipTap's default HTML paste path handle it (HTML is richer). The Markdown paste plugin only activates when `text/html` is absent or empty — i.e., paste from terminals, plain text editors, or raw `.md` files.

**Inside code blocks:** Markdown interpretation is disabled. Paste inserts literal text. The plugin checks if the cursor is inside a `codeBlock` node and bails early.

**Undo:** The entire Markdown parse+insert is a single ProseMirror transaction. One `⌘Z` reverts the whole paste.

### Paste Handler Pipeline (ordered)

Existing handlers fire in plugin registration order. The Markdown paste plugin must slot in correctly.

**Note:** `hyperlinkOnPaste: false` in current config means the hyperlink paste handler is NOT registered at runtime. The actual pipeline is:

```
1. Image paste       → binary file / data URL / image URL → Image node (early exit)
2. Title-document    → paste at doc start, first block not heading → wrap as H1 (early exit)
3. Markdown heuristic → text/plain only, not in codeBlock, passes heuristic → parse as rich content
4. Default           → TipTap default paste (HTML or plain text)
```

If `hyperlinkOnPaste` is ever re-enabled, it should fire between steps 2 and 3 (before Markdown detection).

The Markdown plugin registers via `addProseMirrorPlugins()` and returns `false` from `handlePaste` to pass through if heuristic doesn't match.

### Export Contract

- **Encoding:** UTF-8, no BOM
- **Line endings:** `\n` (Unix). Windows tools handle this fine.
- **DocTitle:** Prepended as `# {title}\n\n` before `editor.getMarkdown()` output
- **DocTitle + body H1 collision:** Both are included. The DocTitle `#` line is the document title; body H1 headings are content headings. This matches how GitHub renders README files with a repo name + `# Heading`.
- **Empty document:** Export produces `# {title}\n` (title only). If title is also empty, disable the export action.
- **Filename:** `{sanitized-title}.md` — strip `/\:*?"<>|`, truncate to 200 chars, fallback to `document.md`
- **Lossy constructs:** Underline and TextAlign are silently dropped (no Markdown equivalent). Export is documented as lossy for these.

### Security

**Protocol sanitization** uses an allowlist (not blocklist — allowlist is categorically safer):

```typescript
const SAFE_PROTOCOLS = /^(?:https?|ftp|mailto|tel|sms):/i

function sanitizeHref(href: string): string | null {
  const cleaned = href.replace(/[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.startsWith('//')) return cleaned // protocol-relative
  if (!cleaned.includes(':') || cleaned.indexOf('/') < cleaned.indexOf(':')) return cleaned // relative
  if (SAFE_PROTOCOLS.test(cleaned)) return cleaned
  if (/^data:image\//i.test(cleaned)) return cleaned // data:image/ exception
  return null
}
```

**Clipboard size limit:** `MAX_CLIPBOARD_SIZE = 500_000` (500KB). Reject before regex scoring or Marked parsing to prevent main-thread freeze.

**Marked HTML passthrough:** Disable raw HTML in Marked config to prevent `<img onerror=...>` and `<script>` injection:

```typescript
Markdown.configure({
  markedOptions: {
    gfm: true,
    tokenizer: { html: () => undefined } // treat HTML tags as escaped text
  }
})
```

If this approach is too aggressive (some users paste MD with legitimate HTML fragments), add a DOMPurify pass on the Marked output before ProseMirror ingestion. The codebase already has DOMPurify (`sanitizeContent.ts`).

## Implementation Phases

### Phase 1 — Install + Wire (`Small`)

Install the package, add the extension, verify basic serialization works.

**API reference:**

```typescript
import { Markdown } from '@tiptap/markdown'

// In baseExtensions array:
Markdown.configure({
  markedOptions: { gfm: true, tokenizer: { html: () => undefined } }
})

// Available after editor init:
editor.getMarkdown() // → string (full doc as Markdown)
editor.markdown.parse(md) // → JSONContent
editor.markdown.serialize(json) // → string
editor.commands.setContent(md, { contentType: 'markdown' }) // replaces all
editor.commands.insertContent(md, { contentType: 'markdown' }) // at cursor
```

**Gotcha:** `contentType: 'markdown'` is mandatory — without it, Markdown strings are parsed as HTML (e.g., `# Heading` becomes literal text).

**Tasks:**

- [x] `bun add @tiptap/markdown` in `packages/webapp/`
- [x] Import `Markdown` from `@tiptap/markdown` in `TipTap.tsx`
- [x] Add `Markdown` to `baseExtensions` array (after `StarterKit`, before custom extensions)
- [x] Configure with `markedOptions: { gfm: true, tokenizer: { html: () => undefined } }` — enable GFM (task lists, strikethrough) + disable raw HTML passthrough (XSS prevention)
- [ ] Smoke test: open editor, type content with headings/bold/lists, call `editor.getMarkdown()` in console, verify output
- [x] Add `editor.getMarkdown` and `editor.markdown.parse` to the `window._editor` test API in `cypress/support/commands.ts`

**Files:**

| File                                               | Change                                                    |
| -------------------------------------------------- | --------------------------------------------------------- |
| `packages/webapp/package.json`                     | Add `@tiptap/markdown` dependency                         |
| `packages/webapp/src/components/TipTap/TipTap.tsx` | Import + configure + add to `baseExtensions`              |
| `packages/webapp/cypress/support/commands.ts`      | Expose `getMarkdown()` and `markdown.parse()` on test API |

### Phase 2 — Custom Extension Hooks (`Small–Medium`)

Add `parseMarkdown`/`renderMarkdown` to extensions not covered by StarterKit defaults.

**Hook signatures (from `@tiptap/markdown` API):**

```typescript
// Mark hook pattern — note: marks pass `node` (not `node.content`) to renderChildren
Hyperlink.extend({
  markdownTokenName: 'link',

  parseMarkdown: (token, helpers) => {
    return helpers.applyMark('hyperlink', helpers.parseInline(token.tokens ?? []), {
      href: token.href || ''
    })
  },

  renderMarkdown: (node, helpers, _context) => {
    const content = helpers.renderChildren(node) // marks: pass node, not node.content
    return `[${content}](${node.attrs?.href || ''})`
  }
})

// Node hook pattern — nodes pass `node.content` to renderChildren
Image.extend({
  markdownTokenName: 'image',

  parseMarkdown: (token, _helpers) => ({
    type: 'Image',
    attrs: { src: token.href || '', alt: token.text || '' }
  }),

  renderMarkdown: (node, _helpers, _context) => {
    return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`
  }
})
```

**Custom tokenizer example** (Highlight — needs tokenizer because `==text==` is not in CommonMark/GFM):

Tokenizers are defined on the extension spec via `tokenizer` field. TipTap auto-registers them. Key rules: method is `tokenize` (not `tokenizer`), `start()` returns `undefined` (not `-1`) for no match, use `lexer.inlineTokens()` for nested mark support.

```typescript
const HighlightWithMarkdown = Highlight.extend({
  markdownTokenName: 'highlight',
  tokenizer: {
    name: 'highlight',
    level: 'inline',
    start: (src) => {
      const i = src.indexOf('==')
      return i >= 0 ? i : undefined
    },
    tokenize: (src, _tokens, lexer) => {
      const match = /^==([^=]+)==/.exec(src)
      if (!match) return undefined
      return {
        type: 'highlight',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1])
      }
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.applyMark('highlight', helpers.parseInline(token.tokens ?? [])),
  renderMarkdown: (node, helpers, _context) => `==${helpers.renderChildren(node)}==`
})
```

**Tasks:**

- [x] Create `packages/webapp/src/components/TipTap/extensions/markdown-extensions.ts` — single file exporting all `.extend()` wrappers:
  - `HyperlinkWithMarkdown` — `[text](url)` hooks (CommonMark standard)
  - `ImageWithMarkdown` — `![alt](src)` hooks (CommonMark standard)
  - `HighlightWithMarkdown` — `==text==` tokenizer + hooks (widely adopted: Obsidian, Marked ecosystem)
- [x] In `TipTap.tsx`: import extended versions and replace originals in `baseExtensions`
- [ ] **CodeBlockLowlight** — verify `language` attribute round-trips via StarterKit default. If language is lost, add hooks in the same file.
- [x] Source extension packages stay **unmodified** — hooks via `.extend()` at webapp level (Image exported as `HyperMultimediaImage`)
- [x] Run `bun run build` at root to verify no type errors

**Deferred (YAGNI — nonstandard Markdown, no user demand yet):**

- Subscript `~text~` / Superscript `^text^` — not in CommonMark or GFM; needs custom tokenizers with strikethrough collision handling. Add when users request it.
- Mention `@name` — nonstandard; no Markdown tool parses this. Add when import is supported.

**Files:**

| File                                                                      | Change                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/webapp/src/components/TipTap/extensions/markdown-extensions.ts` | New — Hyperlink, Image, Highlight `.extend()` wrappers          |
| `packages/webapp/src/components/TipTap/TipTap.tsx`                        | Import extended versions, replace originals in `baseExtensions` |

**Extensions confirmed as no-op:** InlineCode (StarterKit), Underline (dropped), Typography (input rules only), TextAlign (dropped), Subscript/Superscript/Mention (deferred), Table suite (deferred), HeadingActions/Fold/Drag/Filter/Scale (editor plugins, no content), IOSCaretFix, MediaUploadPlaceholder, OptimizedPlaceholder (UI-only).

### Phase 3 — Markdown Paste Plugin (`Medium`)

Detect Markdown in `text/plain` clipboard data and parse as rich content.

**Clipboard precedence logic:**

```typescript
function shouldDetectMarkdown(clipboardData: DataTransfer): boolean {
  const html = clipboardData.getData('text/html')
  const text = clipboardData.getData('text/plain')

  if (!text) return false
  // VS Code pastes include rich HTML — skip MD detection
  if (clipboardData.types.includes('vscode-editor-data')) return false
  // No HTML → plain text is the only candidate
  if (!html) return true
  // HTML is just a macOS shell wrapper (meta + span/div only) → treat as plain
  if (isShellHTML(html)) return true
  // Real HTML present → let TipTap's HTML paste handle it
  return false
}
```

Industry standard (Notion, BlockNote, Google Docs): prefer `text/html` when present. Only run Markdown detection when HTML is absent or trivial.

**Weighted scoring heuristic** (replaces simple pattern count):

````typescript
const SIGNALS = [
  { pattern: /^```[\s\S]*?^```/gm, weight: 10, name: 'fencedCode' },
  { pattern: /^#{1,6}\s+\S/gm, weight: 5, name: 'atxHeading' },
  { pattern: /\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, weight: 5, name: 'inlineLink' },
  { pattern: /!\[([^\]]*)\]\([^\s)]+\)/g, weight: 5, name: 'image' },
  { pattern: /^(?:[-*+]|\d+\.)\s+\S/gm, weight: 3, name: 'listItem' },
  { pattern: /^>\s+\S/gm, weight: 3, name: 'blockquote' },
  { pattern: /\*\*[^*]+\*\*/g, weight: 2, name: 'bold' },
  { pattern: /`[^`]+`/g, weight: 2, name: 'inlineCode' }
]
const THRESHOLD = 6
````

Score ≥ 6 → treat as Markdown. A single `# Heading` (weight 5) plus any bold/code triggers it. Pure prose with a stray `#` won't.

**Code block escape hatch:**

```typescript
handlePaste(view, event, _slice) {
  const { $from } = view.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.spec.code) return false // literal paste in code blocks
  }
  // ... detection logic
}
```

**Security sanitization:** Use `sanitizeHref()` allowlist (defined in Security section above) on all `href` and `src` attributes in the parsed JSONContent before `insertContent`.

**Error handling:**

```typescript
try {
  const json = editor.markdown.parse(text)
  const sanitized = sanitizeJsonContent(json) // walk tree, sanitize hrefs/srcs
  editor.commands.insertContent(sanitized)
} catch (error) {
  logger.warn('markdown-paste: parse/insert failed, falling back to plain text', { error })
  editor.commands.insertContent(text) // plain text fallback
}
```

**Tasks:**

- [x] Create `packages/webapp/src/components/TipTap/extensions/markdown-paste/markdownPastePlugin.ts`
- [x] Implement `shouldDetectMarkdown()` — clipboard precedence (text/html absent or shell wrapper)
- [x] Implement `looksLikeMarkdown()` — weighted scoring with `THRESHOLD = 6`
- [x] Add `MAX_CLIPBOARD_SIZE = 500_000` check — bail early before regex scoring
- [x] Implement `handlePaste`: bail if in codeBlock → check size → check clipboard → score → parse via `editor.markdown.parse(text)` → sanitize links with allowlist → `editor.commands.insertContent(json)` (single transaction = single undo). Wrap in try/catch with plain text fallback.
- [x] Implement `sanitizeHref()` — protocol allowlist (`https?`, `ftp`, `mailto`, `tel`, `sms`, `data:image/`), strip control characters
- [x] Implement `sanitizeJsonContent()` — walk parsed JSONContent tree, apply `sanitizeHref` to all `href`/`src` attrs
- [x] Create `packages/webapp/src/components/TipTap/extensions/markdown-paste/index.ts` — export as `Extension.create`
- [x] Register in `baseExtensions` in `TipTap.tsx` — after image extensions (so their paste handlers fire first per pipeline order)
- [x] Add debug logger: `logger.debug('markdown-paste: heuristic match', { score, patterns })` (per AGENTS.md: keep debug loggers on editor core paths)

**Files:**

| File                                                                                     | Change                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/webapp/src/components/TipTap/extensions/markdown-paste/markdownPastePlugin.ts` | New — plugin with clipboard logic, heuristic, sanitization |
| `packages/webapp/src/components/TipTap/extensions/markdown-paste/index.ts`               | New — extension wrapper                                    |
| `packages/webapp/src/components/TipTap/TipTap.tsx`                                       | Register in `baseExtensions`                               |

### Phase 4 — Export UI (`Small`)

Add "Download as Markdown" action.

**Download implementation:**

```typescript
function downloadAsMarkdown(editor: Editor, title: string): void {
  const titleLine = title.trim() ? `# ${title.trim()}\n\n` : ''
  const body = editor.getMarkdown()
  const content = titleLine + body

  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const filename = sanitizeFilename(title.trim() || 'document') + '.md'
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 10_000)
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .slice(0, 200) || 'document'
  )
}
```

Use Blob + `createObjectURL` (not data URI) — supports large docs, O(1) URL creation, no base64 encoding overhead. MIME type `text/markdown` per RFC 7763. UTF-8 encoding, `\n` line endings.

**Tasks:**

- [x] Add `downloadAsMarkdown(editor, title)` and `sanitizeFilename(name)` in `packages/webapp/src/utils/markdown.ts`
- [x] Add "Download as Markdown" button in `EditorToolbar.tsx` (after Copy Document, before Print)
- [x] Disable export when document is empty and title is empty

**Files:**

| File                                    | Change                                         |
| --------------------------------------- | ---------------------------------------------- |
| `packages/webapp/src/utils/markdown.ts` | New — `downloadAsMarkdown`, `sanitizeFilename` |
| TBD: document actions menu component    | Add "Download as Markdown" item                |

### Phase 5 — E2E Tests (`Medium`)

Cypress tests covering paste, export, and round-trip.

**Tasks:**

- [x] Create `packages/webapp/cypress/e2e/editor/markdown/` directory
- [x] `markdown-paste.cy.js` — Markdown paste detection and rendering:
  - Paste Markdown with headings + bold + links → verify rich content
  - Paste plain text that looks like Markdown (single `#`) → verify heuristic threshold
  - Paste inside code block → verify literal text insertion
  - Paste when `text/html` is present → verify HTML path takes precedence
- [x] `markdown-export.cy.js` — Export functionality:
  - Create document with mixed content → `getMarkdown()` → verify output
  - Export includes heading and body content
  - Bold in content → verify `**bold**` in output
- [x] `markdown-round-trip.cy.js` — Fidelity:
  - Bold, italic, inline code round-trip via `getMarkdown()`
  - Nested list structure preserved
  - `toc-id` persistence: paste Markdown heading → verify `data-toc-id` assigned
  - Lossy constructs: underline present → verify dropped in MD output (not a bug)

**Files:**

| File                                                                    | Change |
| ----------------------------------------------------------------------- | ------ |
| `packages/webapp/cypress/e2e/editor/markdown/markdown-paste.cy.js`      | New    |
| `packages/webapp/cypress/e2e/editor/markdown/markdown-export.cy.js`     | New    |
| `packages/webapp/cypress/e2e/editor/markdown/markdown-round-trip.cy.js` | New    |

## Acceptance Criteria

### Functional

- [ ] `editor.getMarkdown()` returns valid Markdown for all StarterKit nodes + custom extensions
- [ ] Pasting Markdown-only clipboard text renders as rich content (headings, bold, italic, links, images, lists, code blocks)
- [ ] Pasting inside a code block inserts literal text, not parsed Markdown
- [ ] Pasting clipboard with `text/html` present uses HTML path (not Markdown)
- [ ] "Download as Markdown" produces a `.md` file with DocTitle as `# Title` + editor content
- [ ] Underline and TextAlign are silently omitted from Markdown output
- [ ] Hyperlink round-trips as `[text](url)`
- [ ] Image round-trips as `![alt](src)`
- [ ] Code blocks preserve language hint in Markdown output
- [ ] Single undo (`⌘Z`) reverts an entire Markdown paste

### Non-Functional

- [ ] Markdown paste does not degrade typing latency (plugin bails early on non-paste transactions)
- [ ] Export handles documents up to 10k nodes without freezing the UI
- [ ] `javascript:` and `vbscript:` URLs in pasted Markdown links are stripped
- [ ] Debug logger on Markdown paste path (per AGENTS.md convention)

## Dependencies & Risks

| Risk                                                                                            | Mitigation                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tiptap/markdown` edge cases (#7107 hard breaks, #7258 escaped chars, #7590 overlapping marks) | Pin to stable version, monitor releases                                                                                                                                                                               |
| `getMarkdown()` doubles empty paragraphs (#7269: 3 newlines → 6)                                | Accept as cosmetic — CommonMark normalization compresses back on re-parse. Not a blocker.                                                                                                                             |
| `insertContent` can throw RangeError near doc boundaries (#5176)                                | Wrap `insertContent` call in paste plugin with try/catch → fall back to plain text insert                                                                                                                             |
| `selectAll` + paste inserts unwanted newline (#6165)                                            | Known TipTap bug (since v2.11). Test and apply `transformPasted` workaround if triggered.                                                                                                                             |
| `toc-id` loss on export                                                                         | Export-only by design — no import. Document as known limitation.                                                                                                                                                      |
| Paste heuristic false positives                                                                 | Weighted scoring (threshold 6), not simple pattern count. Toast/undo affordance if reports arise.                                                                                                                     |
| Subscript/Superscript/Mention deferred                                                          | Nonstandard Markdown — add only when users request. No complexity cost now.                                                                                                                                           |
| Title-document paste handler + Markdown `#` heading conflict                                    | Pipeline ordering: title-doc fires first, Markdown heuristic second. Title-doc only acts at doc start with non-heading first block — Markdown paste with `# Heading` at start won't conflict because it IS a heading. |
| XSS via pasted Markdown links                                                                   | Protocol allowlist on all `href`/`src` attrs (`https?`, `ftp`, `mailto`, `tel`, `sms`, `data:image/`). Strip control characters. Disable Marked HTML passthrough.                                                     |
| Extension package build breakage                                                                | Run `bun run build` after hook additions to verify tsup output                                                                                                                                                        |

## References

- Brainstorm: [`docs/brainstorms/2026-03-26-editor-markdown-support-brainstorm.md`](../brainstorms/2026-03-26-editor-markdown-support-brainstorm.md)
- Extension registration: `packages/webapp/src/components/TipTap/TipTap.tsx:160-244`
- Existing paste handlers: `title-document.ts:40-81`, `pasteHandler.ts:11-43`, `image/plugin.ts:42-113`
- Existing copy-to-clipboard: `useCopyDocumentToClipboard.tsx:15-28`, `utils/clipboard.ts`
- Hyperlink extension: `packages/extension-hyperlink/src/hyperlink.ts:88-317`
- Image extension: `packages/extension-hypermultimedia/src/nodes/image/image.ts:17-253`
- Test conventions: `.cursor/rules/test-naming-conventions.mdc`, AGENTS.md
- TipTap Markdown docs: https://tiptap.dev/docs/editor/markdown/getting-started
- TipTap extension hooks: https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension
