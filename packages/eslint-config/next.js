// ESLint config for Next.js apps (extends base config)
// Used by: webapp, admin-dashboard
const baseConfig = require('./index.js')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Next.js specific rules
      '@next/next/no-document-import-in-page': 'off',
      'no-fallthrough': ['error', { commentPattern: 'falls through' }],

      // React hooks
      'react-hooks/exhaustive-deps': 'warn',

      // Console restrictions - warn instead of error (allow info, warn, error only)
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name!=/^(info|warn|error|log|debug)$/]",
          message: 'Prefer console.info, console.warn, or console.error in production code.'
        }
      ]
    }
  },
  // Exempt logger utilities from console restrictions
  {
    files: ['**/logger.ts', '**/logger.js', '**/utils/logger.*'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  }
]

// Note: For Tailwind CSS linting, install eslint-plugin-tailwindcss in your package
// and add to your local eslint.config.js:
//
// const tailwindcss = require('eslint-plugin-tailwindcss')
// module.exports = [
//   ...require('@docs.plus/eslint-config/next'),
//   { plugins: { tailwindcss }, rules: tailwindcss.configs.recommended.rules }
// ]
