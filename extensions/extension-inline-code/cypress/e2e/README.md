# extension-inline-code E2E

Clean-room Cypress suite against `test/playground/main.ts` via `@docs.plus/playground` (`docs-playground` on port 5176). Loads built `dist/` like an npm consumer. `?starterkitCode=on` re-enables StarterKit's `code` mark for the collision specs; `?trailingNode=off` lets a nested block sit at the absolute document end for the arrow-exit specs.

| Spec                         | What it proves                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggle.cy.ts`               | Selection toggle on/off/extend; collapsed-caret toggle-off clears code mode                                                                              |
| `input-rule.cy.ts`           | Backtick rule via real typing; triple backticks stay literal; other rules never rewrite code spans; Backspace right after the rule restores the literals |
| `paste.cy.ts`                | Paste rule converts backtick text; bare `<code>` HTML parses; `<pre><code>` does not become inline                                                       |
| `stored-mark-caret.cy.ts`    | Collapsed-caret entry rides stored marks — no zero-width space enters the document                                                                       |
| `arrow-exit.cy.ts`           | ArrowRight at the document end exits code mode without inserting a space — flat, nested last block (blockquote/list), and pending stored mark            |
| `enter-boundary.cy.ts`       | Enter mid-span splits into two clean code spans, no zero-width space                                                                                     |
| `keymap.cy.ts`               | `Mod-e` toggles via a real keydown; with StarterKit `code` enabled it yields `inlineCode`, not `code`                                                    |
| `node-contexts.cy.ts`        | Backtick rule stays literal inside a code block; fires inside a heading                                                                                  |
| `starterkit-collision.cy.ts` | Priority 101 wins backtick input and pasted `<code>` over StarterKit's `code`                                                                            |

Run: `bun run test` from this package (`pretest` build → playground → Cypress).

README hero screenshots: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
