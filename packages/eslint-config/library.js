// ESLint config for library packages (extends base + adds strictness)
// Used by: extension-hyperlink, extension-indent, extension-inline-code,
//          extension-placeholder, extension-hypermultimedia
import baseConfig from './index.js'

export default [
  ...baseConfig,

  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      'no-console': 'warn'
    }
  }
]
