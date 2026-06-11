# Contributing to `@docs.plus/extension-placeholder`

## Tests

Clean-room Cypress E2E runs against the built `dist/` — the same bytes an npm consumer installs. `docs-playground` (from `@docs.plus/playground`) serves the page shell on port 5177; this package commits only the editor fixture (`test/playground/main.ts`) and a one-line `tsconfig.json`.

```sh
bun run test            # build, then Cypress headless
bun run test:e2e        # Cypress headless against the current dist/ (run build first)
bun run test:e2e:watch  # same, but opens the Cypress runner
bun run playground      # playground only, http://127.0.0.1:5177
bun run docs:screenshots # regenerate README hero PNGs in assets/
```

`docs:screenshots` overwrites tracked `assets/preview-*.png`.

The playground accepts query-string flags:

| Flag                          | Effect                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| `?editable=false`             | Editor starts read-only                                                |
| `?showOnlyWhenEditable=false` | Placeholder visible even when the editor is not editable               |
| `?placeholder=fn`             | Function form — per-node text (`Untitled` for headings, etc.)          |
| `?placeholder=empty`          | Function returns `''` — suppresses decorations                         |
| `?nodeClass=custom`           | Sets `emptyNodeClass` / `emptyEditorClass` for class-propagation specs |

Spec scope lives in [cypress/e2e/README.md](./cypress/e2e/README.md).

## Development

```sh
bun install      # from the repo root
bun run build    # tsup → dist/ (ESM + CJS + d.ts)
bun run dev      # tsup --watch
bun run lint     # eslint
bun run typecheck
```

The suite also runs from the repo root via `bun run test`, alongside the other extension and webapp suites.
