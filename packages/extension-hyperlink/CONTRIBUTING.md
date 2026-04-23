# Contributing to `@docs.plus/extension-hyperlink`

## Tests

Two suites: a Bun-native unit suite (~95 ms) and Cypress E2E that runs against the built `dist/` output via a `Bun.serve` playground — the same bytes an npm consumer installs.

```sh
bun run test             # unit + build + Cypress headless
bun run test:unit        # unit only (Bun native, ~95 ms)
bun run test:unit:watch  # unit in watch mode
bun run test:e2e         # build + Cypress headless (skip unit)
bun run test:open        # build + open the Cypress runner
bun run playground       # playground only, http://127.0.0.1:5173
bun run docs:screenshots # regenerate README hero PNGs in docs/screenshots/
```

The playground accepts query-string flags so the dedicated specs can exercise opt-in behaviors without forking the bootstrap:

| Flag                    | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `?popover=custom`       | Swap prebuilt popovers for minimal BYO factories that record calls on `_byo`.   |
| `?shouldAutoLink=block` | Wire `shouldAutoLink: () => false` so the per-URI veto is exercised everywhere. |
| `?clickSelection=on`    | Set `enableClickSelection: true` (click-to-select-mark-range).                  |
| `?exitable=on`          | Set `exitable: true` (ArrowRight at the right edge clears the storedMark).      |

### Cypress specs

10 files, ~132 tests:

| Spec                      | Covers                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `create.cy.ts`            | `Mod+K`, Apply state, href canonicalization, host validation, dismiss.                           |
| `preview-edit.cy.ts`      | Click → preview → edit/copy/remove, Back, Escape lifecycle.                                      |
| `autolink.cy.ts`          | Autolink, paste, and `mailto:` produce the same `href`; `code`-mark skip; `shouldAutoLink` veto. |
| `special-schemes.cy.ts`   | 50+ scheme catalog (`whatsapp:`, `tg:`, `vscode:`, `spotify:`, …) parses + previews.             |
| `xss-guards.cy.ts`        | `javascript:` / `data:` / `vbscript:` / `file:` / `blob:` blocked; `renderHTML` re-validation.   |
| `nav-guards.cy.ts`        | Middle-click safety — safe-href passthrough, dangerous-scheme refusal, right-click untouched.    |
| `canon-options.cy.ts`     | `enableClickSelection` and `exitable` canon-option semantics.                                    |
| `styling.cy.ts`           | `styles.css` loaded, `--hl-*` tokens resolve, `light-dark()` branch.                             |
| `custom-popover.cy.ts`    | BYO factory contract — options, mount lifecycle, exports.                                        |
| `scroll-stickiness.cy.ts` | Popover follows its anchor across scroll without drift.                                          |

The suite also runs from the repo root via `bun run test:all`, alongside the Jest and webapp Cypress suites.
