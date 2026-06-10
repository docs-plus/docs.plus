# extension-hyperlink E2E

Clean-room Cypress suite against `test/playground/main.ts` via `@docs.plus/playground` (`docs-playground` on port 5173). Loads built `dist/` like an npm consumer.

## Specs

| Spec                      | What it proves                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `create.cy.ts`            | Mod-k create popover: lifecycle, URL validation/normalization (bare domains, phones, emails), documented DOM contract |
| `preview-edit.cy.ts`      | Preview/edit popovers: open on click, edit/Back stash integrity, byte-identical link disambiguation, Remove           |
| `autolink.cy.ts`          | Autolink + paste canonical-href parity; `shouldAutoLink` veto across autolink, paste handler, and paste rule          |
| `full-doc-paste.cy.ts`    | Select-all paste of a mixed doc: bare URLs linkify once with canonical hrefs; h2/blockquote structure survives        |
| `undo-redo.cy.ts`         | Autolink undo keeps text / redo restores the canonical href; preview Remove reverts in one undo step                  |
| `node-contexts.cy.ts`     | Code block rejects autolink; heading/list structure survives linking; the mark stops at Enter (`keepOnSplit: false`)  |
| `destroy-lifecycle.cy.ts` | Editor destroy closes only its own popover; a foreign editor's destroy leaves an open popover mounted                 |
| `xss-guards.cy.ts`        | Dangerous schemes blocked at parse, input rule, click, serialize; control chars can't smuggle `javascript:`           |
| `nav-guards.cy.ts`        | Middle-click (`auxclick`) routes through the navigation gate with `noopener,noreferrer`                               |
| `special-schemes.cy.ts`   | 50+ app deep-link schemes and domain mappings through autolink + create popover                                       |
| `canon-options.cy.ts`     | `enableClickSelection` and `exitable` opt-in behaviors                                                                |
| `custom-popover.cy.ts`    | BYO factory contract (`?popover=custom`): option shapes, `validate` forwarding, controller lifecycle                  |
| `scroll-stickiness.cy.ts` | Popovers track their anchor on scroll (live virtual references)                                                       |
| `styling.cy.ts`           | `styles.css` ships via the exports map: `--hl-*` tokens, class contract, `light-dark()` theming                       |

`_debug.cy.ts` (when present) is scratch space and excluded from release counts. `cypress/docs/popovers.cy.ts` regenerates README screenshots and runs only via `bun run docs:screenshots`.

Run: `bun run test` from this package (`pretest` build → unit suite → playground → Cypress). E2E only: `bun run test:e2e` (build first).
