# extension-placeholder E2E

Clean-room Cypress suite against `test/playground/main.ts` via `@docs.plus/playground` (`docs-playground` on port 5177). Loads built `dist/` like an npm consumer.

| Spec                         | What it proves                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `empty-doc.cy.ts`            | Fresh empty editor shows the placeholder; first character clears it; emptying restores it         |
| `cursor-tracking.cy.ts`      | Decoration follows the cursor's empty parent; `is-editor-empty` withheld on non-empty docs        |
| `ancestor-propagation.cy.ts` | Empty wrappers (blockquote, list item) get `is-empty`; `data-placeholder` stays on the inner node |
| `non-empty-nodes.cy.ts`      | A space and a hard break count as content; an empty heading does not                              |
| `placeholder-text.cy.ts`     | Function form receives `parentName`; empty string suppresses decorations; custom classes          |
| `heading-placeholder.cy.ts`  | Function form switches text per node type (`Untitled` for headings)                               |
| `editable-toggle.cy.ts`      | `showOnlyWhenEditable` plus runtime `setEditable()` refresh                                       |
| `external-edit.cy.ts`        | Selection-preserving doc edits (collab-shaped) keep and shift the decoration                      |
| `history-restore.cy.ts`      | Undo back to the empty doc restores the placeholder; redo removes it                              |
| `full-doc-paste.cy.ts`       | Full-document paste clears the placeholder; select-all delete restores it                         |
| `gap-cursor.cy.ts`           | `NodeSelection` on `<hr>` and the gap cursor produce no decoration and no exception               |
| `backspace-restore.cy.ts`    | Real typing and Backspace (`beforeinput` pipeline) round-trip the placeholder                     |

Run: `bun run test` from this package (`pretest` build → playground → Cypress).
