# Markdown Tests

E2E tests for the `@tiptap/markdown` integration.

## Scope

- **markdown-paste.cy.js** — Paste detection and insertion
  - Heuristic scoring: threshold behavior, weight combinations, below-threshold rejection
  - Clipboard precedence: HTML vs plain text, VS Code bypass, macOS shell HTML wrappers
  - Code block bypass: literal text insertion inside `<pre>`
  - Security: `javascript:` protocol stripping, `data:` URI filtering, oversized clipboard guard

- **markdown-export.cy.js** — Export via `getMarkdown()` and toolbar button
  - Inline marks: bold, italic, inline code, strikethrough
  - Lists: bullet, ordered
  - Links: hyperlink serialization
  - Highlight: `==text==` custom mark
  - Toolbar: download button enabled/disabled state

- **markdown-round-trip.cy.js** — Paste → DOM → Export fidelity
  - Inline marks: bold, italic, code, nested bold+italic, lossy underline
  - Block elements: blockquotes, horizontal rules, nested lists
  - Code blocks: content preservation, language hint round-trip
  - Headings: `toc-id` persistence, level preservation
  - Links and images: full URL round-trip
  - Highlight: `==text==` round-trip
  - `_parseMarkdown` API: JSONContent structure validation
