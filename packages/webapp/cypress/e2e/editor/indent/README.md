# Indent extension E2E

Coverage for `@docs.plus/extension-indent` in the real editor (`TipTap.tsx`: `indentChars: '\t'`; default `allowedIndentContexts` are body + blockquote paragraphs). Non-default context rules are covered by Jest in `packages/extension-indent`.

**Files:** `indent-shared.js` (helpers); `indent-paragraph-and-gates.cy.js`; `indent-lists.cy.js`; `indent-multiline.cy.js`; `indent-table.cy.js`; `indent-code-list.cy.js`.

## Scope

- **`indent-paragraph-and-gates`:** literal Tab / Shift+Tab in paragraphs; heading vs paragraph vs blockquote gates
- **`indent-lists`:** keyboard sink/lift; programmatic nested / mixed lists; `indent()` false in list when parent is `listItem` (default allowlist)
- **`indent-multiline`:** `indent()` / `outdent()` and keyboard Tab across multi-paragraph selections
- **`indent-table`:** Tab / Shift+Tab delegate to table cells (no literal `\t` in text)
- **`indent-code-list`:** code block has no literal tab indent under default contexts; list item `indent()` API gate

Shared (`indent-shared.js`): `EDITOR` / `PM`, `MS`, `getEditor` / `getText`, `setupIndentSpec(docName)` (visit + clear), `paragraphTextCaretPos` / `paragraphSelectionBounds`, TipTap JSON (`heading1`, `paragraphNode`, doc builders), `setDoc`, list/table helpers. Re-exports `docMaker` + `TEST_TITLE` so specs use one import for fixture + selectors.
