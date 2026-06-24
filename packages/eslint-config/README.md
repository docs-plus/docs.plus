# @docs.plus/eslint-config

Shared ESLint configurations for the docs.plus monorepo.

**ESLint 9 flat config** format.

## Quick Start

Every package needs a flat-config shim at its package root. Use **relative paths** for reliable resolution.

| Package kind                       | Shim file           | Why                                                                                                  |
| ---------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Root, webapp, admin-dashboard      | `eslint.config.mjs` | No `"type": "module"` in `package.json` — `.mjs` avoids Node `MODULE_TYPELESS_PACKAGE_JSON` warnings |
| `hocuspocus.server`, `extension-*` | `eslint.config.js`  | Package has `"type": "module"`                                                                       |

### Next.js apps (webapp, admin-dashboard)

```js
// apps/webapp/eslint.config.mjs
import nextConfig from '../../packages/eslint-config/next.js'

export default [{ ignores: ['src/types/supabase.ts'] }, ...nextConfig]
```

### ESM backend (`"type": "module"`)

```js
// apps/hocuspocus.server/eslint.config.js
import baseConfig from '../../packages/eslint-config/index.js'

export default baseConfig
```

### Published extensions (`library.js`)

```js
// extensions/extension-hyperlink/eslint.config.js
import libraryConfig from '../../packages/eslint-config/library.js'

export default libraryConfig
```

## Available Configs

| Config  | Import Path                   | Use For                |
| ------- | ----------------------------- | ---------------------- |
| Base    | `../eslint-config/index.js`   | Backend services       |
| Next.js | `../eslint-config/next.js`    | Next.js apps           |
| Library | `../eslint-config/library.js` | Published npm packages |

### Config Features

| Feature          | Base | Next.js   | Library   |
| ---------------- | ---- | --------- | --------- |
| TypeScript       | ✅   | ✅        | ✅        |
| React/JSX        | ✅   | ✅        | ✅        |
| Prettier         | ✅   | ✅        | ✅        |
| React Hooks      | -    | ✅        | -         |
| Console warnings | -    | ✅ (warn) | ✅ (warn) |
| Strict types     | -    | -         | ✅        |

## Lint policy (repo root)

- `bun run lint` runs `eslint . --max-warnings=0` — warnings fail CI and pre-push (`bun run check`).
- Pre-commit `lint-staged` also uses `--max-warnings=0` on staged files only.
- Fix hook dependency warnings in source; do not relax the global gate.

## Current Usage

| Package           | Shim                | Config       |
| ----------------- | ------------------- | ------------ |
| root              | `eslint.config.mjs` | `index.js`   |
| webapp            | `eslint.config.mjs` | `next.js`    |
| admin-dashboard   | `eslint.config.mjs` | `next.js`    |
| hocuspocus.server | `eslint.config.js`  | `index.js`   |
| extension-\*      | `eslint.config.js`  | `library.js` |

## Custom Overrides

```js
import nextConfig from '../../packages/eslint-config/next.js'

export default [
  ...nextConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
]
```

## Key Rules

| Rule                                 | Setting  | Rationale                   |
| ------------------------------------ | -------- | --------------------------- |
| `no-unused-vars`                     | warn     | Prefix with `_` to ignore   |
| `no-console`                         | off/warn | Off for apps, warn for libs |
| `@typescript-eslint/no-explicit-any` | off      | Pragmatic choice            |
| `react-hooks/exhaustive-deps`        | warn     | Catches common bugs         |
