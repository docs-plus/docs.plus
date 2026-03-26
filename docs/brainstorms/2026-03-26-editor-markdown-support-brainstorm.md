---
date: 2026-03-26
topic: editor-markdown-support
---

# Full Markdown Support

## What We're Building

Bidirectional Markdown support for the editor using `@tiptap/markdown` — paste and export Markdown. Users can paste Markdown text and have it render as rich content, export documents as `.md` files, and the editor round-trips Markdown accurately for all supported node/mark types. File import is not in scope (see `toc-id` risk).

Currently there is no Markdown integration. The editor uses Yjs/JSON for storage and HTML for clipboard. StarterKit provides basic input rules (`#` for headings, `**` for bold, etc.) but no Markdown parsing or serialization.

## Why This Approach

**Approach chosen:** Install `@tiptap/markdown` (first-party TipTap extension).

**Approaches considered:**

| Approach                         | Verdict                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| A. `@tiptap/markdown` (chosen)   | First-party, maintained, Marked-based, TipTap integration helpers |
| B. `prosemirror-markdown` bridge | Battle-tested but significantly more code, manual schema mapping  |
| C. `remark`/`unified` pipeline   | Best fidelity but heavy integration, overengineering              |

**Why A wins:** `@tiptap/markdown` is the official TipTap extension, actively maintained, and provides `getMarkdown()` / `setContent(..., 'markdown')` / `MarkdownManager` out of the box. Custom extensions need `parseMarkdown`/`renderMarkdown` hooks, but the integration surface is well-documented. Known edge-case bugs (hard breaks, escaped chars) are actively being patched.

## Key Decisions

- **Storage format:** Unchanged — Yjs/JSON remains the collaboration and persistence format. Markdown is an import/export layer only, not a storage format.
- **Paste behavior:** Detect Markdown in `text/plain` clipboard data and parse it as rich content. Use a heuristic (heading syntax, bold markers, link syntax, list markers) to distinguish Markdown from plain text.
- **Export:** Add "Download as Markdown" option. Uses `editor.getMarkdown()` for serialization. The exported file prepends the DocTitle (from `PadTitle`) as a `# Title` line at the top, since it lives outside the editor content.
- **Custom extension hooks:** Add `parseMarkdown` and `renderMarkdown` to custom extensions not covered by StarterKit defaults:
  - `@docs.plus/extension-hyperlink` — `[text](url)` parse/render hooks
  - `@docs.plus/extension-hypermultimedia` — `![alt](url)` for images
  - `Highlight` — `==text==` (GFM-style highlight syntax)
  - `Subscript` / `Superscript` — `~sub~` / `^super^` (if Marked tokenizer supports; otherwise defer)
  - `Mention` — serialize as `@name`, parse back via custom tokenizer
  - `CodeBlockLowlight` — fenced code blocks with language hint (` `lang ```) — verify StarterKit default covers this; add hooks if language attr is lost
- **Extensions that need NO hooks:** `InlineCode` (handled by StarterKit's `code` mark), `Underline` (no standard Markdown syntax — silently dropped on export), `Typography` (input rules only, no serialization), `TextAlign` (block attr — not expressible in Markdown, silently dropped), `Table`/`TableRow`/`TableHeader`/`TableCell` (deferred — see below), `HeadingActionsExtension`/`HeadingFold`/`HeadingDrag`/`HeadingFilter`/`HeadingScale` (editor-only plugins, no content), `IOSCaretFix`/`MediaUploadPlaceholder`/`OptimizedPlaceholder` (UI-only).
- **What's NOT included:** GFM tables (resizable + merged cells — defer MD round-trip). Footnotes. Math/LaTeX. These can be added later with custom tokenizers.
- **TipTap version:** Current version is `^3.20.4` — compatible with `@tiptap/markdown` (requires v3.x). No version blocker.

## Scope of Changes

| Area                                           | Files                                                 | Effort |
| ---------------------------------------------- | ----------------------------------------------------- | ------ |
| Install `@tiptap/markdown`                     | `package.json`, `bun.lock`                            | Small  |
| Wire extension in editor config                | `TipTap.tsx`                                          | Small  |
| Add MD hooks to Hyperlink                      | `packages/extension-hyperlink/src/hyperlink.ts`       | Small  |
| Add MD hooks to Image                          | `packages/extension-hypermultimedia/src/nodes/image/` | Small  |
| Add MD hooks to Highlight, Sub/Super, Mention  | Respective extension files                            | Small  |
| Verify CodeBlockLowlight lang attr round-trips | `TipTap.tsx` / extension config                       | Small  |
| Markdown paste detection plugin                | New plugin or extend existing paste handling          | Medium |
| Export-as-Markdown UI                          | Menu/button + download logic                          | Small  |
| Cypress tests for Markdown round-trip          | New test file                                         | Medium |

## Known Risks

- **`toc-id` loss on round-trip:** Headings carry a `toc-id` attribute (via UniqueID) that drives fold state, TOC anchors, and collab references. `getMarkdown()` serializes headings as plain `# Heading` — `toc-id` is lost. On re-import, new IDs are generated, breaking fold state and TOC links. **Mitigation:** Markdown is export-only by default. If "import Markdown" is ever added, warn users that heading IDs will be regenerated and fold state will reset.
- **`@tiptap/markdown` edge cases:** Hard breaks (#7107), escaped characters (#7258), overlapping marks (#7590) are known issues. Monitor TipTap releases and pin to a stable version.
- **Custom extensions without hooks:** Any extension lacking `parseMarkdown`/`renderMarkdown` is silently dropped during serialization. The full audit is in "Key Decisions" above — verify after integration.
- **Paste heuristic false positives:** Plain text resembling Markdown (e.g., `# ` at line start) could be incorrectly parsed as rich content. **Decision:** Start with heuristic-only (detect `# `, `**`, `- [ ]`, `[text](url)` patterns). If false positives are reported, add a toast/undo affordance — not a modal toggle.
- **GFM tables:** Resizable + merged cells make table round-trip a separate effort — defer explicitly.

## Open Questions

- **Mention serialization:** Should `@name` in Markdown re-resolve to the original user on import, or just render as literal text? Depends on whether import is ever supported.

## Research Sources

- [TipTap — Markdown getting started](https://tiptap.dev/docs/editor/markdown/getting-started)
- [TipTap — Markdown examples](https://tiptap.dev/docs/editor/markdown/examples)
- [TipTap — Integrate Markdown in your extension](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension)
- [TipTap — Custom serializing](https://tiptap.dev/docs/editor/markdown/advanced-usage/custom-serializing)
- [TipTap — Introducing bidirectional Markdown](https://tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap)
- [TipTap #6821 — Markdown PR](https://github.com/ueberdosis/tiptap/pull/6821)
- [TipTap #7107 — Hard breaks](https://github.com/ueberdosis/tiptap/issues/7107)
- [TipTap #7258 — Escaped characters](https://github.com/ueberdosis/tiptap/issues/7258)
- [TipTap #7590 — Overlapping marks](https://github.com/ueberdosis/tiptap/issues/7590)

## Next Steps

→ `/workflows:plan` for implementation details
