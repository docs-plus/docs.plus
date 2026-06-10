# Contributing to `@docs.plus/extension-hyperlink`

## Tests

Two suites: a Bun-native unit suite (~95 ms) and Cypress E2E that runs against the built `dist/` output via `@docs.plus/playground` (`docs-playground` serves the page shell; this package commits only `test/playground/main.ts`) — the same bytes an npm consumer installs.

```sh
bun run test             # build, then unit, then Cypress headless
bun run test:unit        # unit only (Bun native, ~95 ms)
bun run test:unit:watch  # unit in watch mode
bun run test:e2e         # Cypress headless against the current dist/ (run build first)
bun run test:e2e:watch   # same, but opens the Cypress runner
bun run playground       # playground only, http://127.0.0.1:5173
bun run docs:screenshots # regenerate README hero PNGs in docs/screenshots/
```

`docs:screenshots` regenerates into the gitignored `docs/screenshots/`; when refreshing the README hero, copy the new PNGs into `assets/` — the tracked source the README hotlinks.

The playground accepts query-string flags so the dedicated specs can exercise opt-in behaviors without forking the bootstrap:

| Flag                    | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `?popover=custom`       | Swap prebuilt popovers for minimal BYO factories that record calls on `_byo`.   |
| `?shouldAutoLink=block` | Wire `shouldAutoLink: () => false` so the per-URI veto is exercised everywhere. |
| `?clickSelection=on`    | Set `enableClickSelection: true` (click-to-select-mark-range).                  |
| `?exitable=on`          | Set `exitable: true` (ArrowRight at the right edge clears the storedMark).      |

Spec scope — 14 files, 150 tests — lives in [cypress/e2e/README.md](./cypress/e2e/README.md).

## Development

```sh
bun install      # from the repo root
bun run build    # tsup → dist/ (ESM + CJS + d.ts)
bun run dev      # tsup --watch
bun run lint     # eslint
bun run typecheck
```

The suite also runs from the repo root via `bun run test`, alongside the other extension and webapp suites.
