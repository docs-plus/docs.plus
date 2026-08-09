# Contributing to `@docs.plus/extension-hyperlink`

## Tests

Two suites: a Bun-native unit suite and clean-room Cypress E2E that runs against the built `dist/` — the same bytes an npm consumer installs. `docs-playground` (from `@docs.plus/playground`) serves the page shell on port 5173; this package commits only the editor fixture (`test/playground/main.ts`) and a one-line `tsconfig.json`.

```sh
bun run test             # build, then unit, then Cypress headless
bun run test:unit        # unit only (Bun native)
bun run test:unit:watch  # unit in watch mode
bun run test:e2e         # Cypress headless against the current dist/ (run build first)
bun run test:e2e:watch   # same, but opens the Cypress runner
bun run playground       # playground only, http://127.0.0.1:5173 (run build first)
bun run docs:screenshots # regenerate README hero PNGs in assets/
```

`docs:screenshots` overwrites tracked `assets/preview-*.png` (README hotlinks).

The playground accepts query-string flags so the dedicated specs can exercise opt-in behaviors without forking the bootstrap:

| Flag                    | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `?popover=custom`       | Swap prebuilt popovers for minimal BYO factories that record calls on `_byo`.   |
| `?popover=none`         | Leave both popover factories `null` — exercises the no-popover click fallback.  |
| `?readonly=on`          | Lock the editor with `setEditable(false)` after mount (read-only doc).          |
| `?shouldAutoLink=block` | Wire `shouldAutoLink: () => false` so the per-URI veto is exercised everywhere. |
| `?clickSelection=on`    | Set `enableClickSelection: true` (click-to-select-mark-range).                  |
| `?exitable=on`          | Set `exitable: true` (ArrowRight at the right edge clears the storedMark).      |

Spec scope — 16 files — lives in [cypress/e2e/README.md](./cypress/e2e/README.md). README gallery (`cypress/docs/readme-gallery.cy.ts`) captures create, preview, and edit popovers (light + dark) into `assets/`.

## Real-device tap checklist

`touch-tap.cy.ts` pins the synthetic layer. iOS Safari's caret/keyboard races, tap-delay heuristics, and auto-scroll cannot be reproduced with synthetic events — verify on hardware, iOS Safari and Android Chrome both:

1. Tap a link in an editable doc — the preview popover opens; no navigation, no keyboard, no scroll jump (caret suppression on link taps is webapp-owned: `iosCaretFixPlugin` early-returns on link targets).
2. Dismiss the popover, then tap plain text — the caret lands at the tap point and the keyboard opens.
3. Tap a link in a read-only doc — the link opens in a new tab.

## Development

```sh
bun install      # from the repo root
bun run build    # tsup → dist/ (ESM + CJS + d.ts)
bun run dev      # tsup --watch
bun run typecheck
```

**Fresh clone:** `dist/` is gitignored and `bun install` does not build it, so `bun run playground` and `bun run test:e2e` fail with a module-resolution error until a build runs. `bun run build` inside this package is not enough — run `bash scripts/build-extensions.sh` from the repo root instead. This package bundles the private `@docs.plus/floating-popover` and `@docs.plus/floating-tooltip` packages, whose `exports` also point at a gitignored `dist/`, so a package-local build stops first with `Could not resolve "@docs.plus/floating-popover"`. The root script builds those two before the extensions.

**Restart the playground after a production build.** `bun run build` sets `NODE_ENV=production`, which turns on tsup's `clean` and empties `dist/` under a running `bun --hot` server. `bun run dev` (tsup --watch) does not clean, so it can rebuild while the playground runs.

ESLint: from repo root, `bun run lint` (cascades into this package).

The suite also runs from the repo root via `bun run test`, alongside the other extension and webapp suites.
