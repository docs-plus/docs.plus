# extension-indent E2E

Clean-room Cypress suite against `test/playground/main.ts` via `@docs.plus/playground` (`docs-playground` on port 5175). Loads built `dist/` like an npm consumer, on the published 2-space default. Jest owns the `allowedIndentContexts` matrix; the webapp suite (`apps/webapp/cypress/e2e/editor/indent/`) covers the production `'\t'` config.

| Spec                      | What it proves                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `paragraph-indent.cy.ts`  | Caret Tab/Shift-Tab on the 2-space default; line-start outdent; `?contexts=none`; list keymap precedence |
| `multiline-indent.cy.ts`  | Cross-paragraph selections; all-or-nothing context gate; single-transaction undo                         |
| `midline-selection.cy.ts` | Mid-word selection starts clamp to line starts; select-all indents eligible blocks                       |
| `hardbreak-outdent.cy.ts` | Shift-Tab never deletes a hardBreak in place of indent characters                                        |
| `blockquote-indent.cy.ts` | Default allowlist: blockquote paragraphs indent/outdent; headings are a no-op                            |
| `codeblock-indent.cy.ts`  | codeBlock gating; embedded `\n` is not treated as a block separator                                      |
| `list-precedence.cy.ts`   | Sink/lift wins over literal indent; `?contexts=none` still sinks and lifts                               |

Keymaps fire from synthetic `keydown` triggers (`cy.pressKey`); indents are created with real Tab presses because `setContent` HTML parsing collapses literal leading spaces.

Run: `bun run test` from this package (`pretest` build → Jest units → playground → Cypress). E2E only: `bun run test:e2e` (build first).

README hero screenshots: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
