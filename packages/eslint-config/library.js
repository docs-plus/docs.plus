// ESLint config for library packages (extends base config)
const baseConfig = require('./index.js')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Library-specific rules - stricter
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      'no-console': 'warn' // Libraries should avoid console
    }
  }
]
