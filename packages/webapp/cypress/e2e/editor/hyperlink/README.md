# Hyperlink Extension E2E

Coverage for `@docs.plus/extension-hyperlink` in the real editor (`TipTap.tsx`: `autolink: true`, `linkOnPaste: false`, `protocols: ['ftp', 'mailto']`, both popover factories set).

## Scope

- **hyperlink-create.cy.js** — Create popover + `setHyperlink` command
  - Mod+K and toolbar button trigger, Apply button state, valid/invalid URL submission, error display, Escape dismiss, outside-click dismiss, URL prefix normalization (`https://`)

- **hyperlink-preview-edit.cy.js** — Preview popover + edit popover + remove + copy
  - Click-to-preview, href display, open-in-new-tab, remove link, copy href, edit button transition, edit pre-fill, text/URL editing, edit validation, Back button return

- **hyperlink-autolink.cy.js** — Autolink on typing
  - URL + space/Enter triggers, non-URL no-op, registered protocols (ftp, mailto), unlink on edit, image markdown guard, trailing punctuation stripping, special scheme URLs

- **hyperlink-paste.cy.js** — Paste behavior
  - Markdown paste creates link, bare URL paste creates link, paste-over-selection disabled (linkOnPaste: false), HTML anchor preservation, javascript: href stripping

- **hyperlink-markdown.cy.js** — Markdown input rule `[text](url)`
  - Inline markdown to hyperlink, https:// prefix for bare domains, protocol-relative URLs, image syntax exclusion, special characters in URL

- **hyperlink-edge-cases.cy.js** — Boundary conditions + keyboard + misc
  - Escape dismiss, Tab focus trap, undo, multiple links, link at paragraph start/end, URL replacement, long URLs

- **hyperlink-picker.cy.js** — Suggestion picker (in-doc headings + workspace bookmarks) on the create + edit popovers
  - Create / pick heading: expand → click row inserts heading deep-link (`?h=…&id=…`) with the picked title as anchor text
  - Create / keyboard: ArrowDown opens the panel, Enter picks the highlighted row
  - Create / pick bookmark: workspace RPC stubbed via `setupBookmarkSuggestions`; Bookmarks section renders, archived rows show the badge, click inserts a chatroom deep-link (`?msg_id=…&chatroom=…`)
  - Create / typed URL: typing filters by title; a full URL bypasses suggestions and Apply commits it verbatim
  - Edit popover: pick heading re-points href and replaces link text; user-edited text (`textTouched`) survives a heading pick; pick bookmark re-points href to a chatroom deep-link

  Bookmark coverage relies on `window._store` (exposed by `pages/editor.tsx` for the playground only) to seed `workspaceId` and on `cy.intercept` against the Supabase `get_user_bookmarks` RPC. See `cypress/support/hyperlinkPicker.ts` for the fixture + helper.
