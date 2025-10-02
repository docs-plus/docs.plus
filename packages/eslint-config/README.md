# @docs.plus/eslint-config

Shared ESLint configuration for the docs.plus monorepo.

## Usage

### For Library Packages (extensions, etc.)

```js
// eslint.config.js
export default require('@docs.plus/eslint-config/library');
```

### For Next.js App (webapp)

```js
// eslint.config.js
export default require('@docs.plus/eslint-config/next');
```

### For Backend Services (hocuspocus.server)

```js
// eslint.config.js
export default require('@docs.plus/eslint-config');
```

## Configs

- **`@docs.plus/eslint-config`** - Base config for all packages
- **`@docs.plus/eslint-config/next`** - Extended config for Next.js apps
- **`@docs.plus/eslint-config/library`** - Extended config for library packages

## Benefits

- ✅ Single source of truth
- ✅ Consistent rules across monorepo
- ✅ Easy to update - change once, apply everywhere
- ✅ Package-specific overrides when needed
