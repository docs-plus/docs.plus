# @docs.plus/eslint-config

Shared ESLint configurations for the docs.plus monorepo.

**ESLint 9 Flat Config** format.

## Quick Start

Every package needs an `eslint.config.js`. Use **relative paths** for reliable resolution.

### CommonJS Packages

```js
// packages/webapp/eslint.config.js
module.exports = require('../eslint-config/next.js')
```

### ESM Packages (`"type": "module"`)

```js
// packages/hocuspocus.server/eslint.config.js
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

export default require('../eslint-config/index.js')
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

## Current Usage

| Package           | Config       |
| ----------------- | ------------ |
| root              | `index.js`   |
| webapp            | `next.js`    |
| admin-dashboard   | `next.js`    |
| hocuspocus.server | `index.js`   |
| extension-\*      | `library.js` |

## Custom Overrides

```js
// Spread the config and add overrides
module.exports = [
  ...require('../eslint-config/next.js'),
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
]
```

## Adding Tailwind Plugin

```js
const tailwindcss = require('eslint-plugin-tailwindcss')

module.exports = [
  ...require('../eslint-config/next.js'),
  {
    plugins: { tailwindcss },
    rules: tailwindcss.configs.recommended.rules
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
