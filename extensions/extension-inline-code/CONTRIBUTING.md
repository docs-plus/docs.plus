# Contributing to `@docs.plus/extension-inline-code`

## Tests

Clean-room Cypress E2E runs against the built `dist/` — the same bytes an npm consumer installs. `docs-playground` (from `@docs.plus/playground`) serves the page shell on port 5176; this package commits only the editor fixture (`test/playground/main.ts`) and a one-line `tsconfig.json`.

```sh
bun run test            # build, then Cypress headless
bun run test:e2e        # Cypress headless against the current dist/ (run build first)
bun run test:e2e:watch  # same, but opens the Cypress runner
bun run playground      # playground only, http://127.0.0.1:5176
bun run docs:screenshots # regenerate README hero PNGs in assets/
```

`docs:screenshots` overwrites tracked `assets/preview-*.png`.

The playground accepts query-string flags:

| Flag                 | Effect                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `?starterkitCode=on` | Re-enables StarterKit's `code` mark so collision specs verify InlineCode priority 101 wins |
| `?trailingNode=off`  | Drops StarterKit's trailing paragraph so arrow-exit specs can end on a nested last block   |

Spec scope lives in [cypress/e2e/README.md](./cypress/e2e/README.md).

## Development

```sh
bun install      # from the repo root
bun run build    # tsup → dist/ (ESM + CJS + d.ts)
bun run dev      # tsup --watch
bun run typecheck
```

ESLint: from repo root, `bun run lint` (cascades into this package).

The suite also runs from the repo root via `bun run test`, alongside the other extension and webapp suites.
