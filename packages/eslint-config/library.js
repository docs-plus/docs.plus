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
      // console.warn / console.error survive production builds on purpose
      // (tsup keeps them as diagnostic channels); only console.log is noise.
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
]
