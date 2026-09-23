import baseConfig from './index.js'

export default [
  ...baseConfig,

  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      // tsup keeps warn/error as diagnostic channels; only console.log is noise.
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },

  // StackBlitz copies of the README Quickstart. They must match the README word for word.
  { ignores: ['examples/**'] }
]
