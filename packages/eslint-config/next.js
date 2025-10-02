// ESLint config for Next.js apps (extends base config)
const baseConfig = require('./index.js')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Next.js specific rules
      '@next/next/no-document-import-in-page': 'off',
      'no-fallthrough': ['error', { commentPattern: 'falls through' }],
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name!=/^(info|error)$/]",
          message: 'Unexpected console method. Use console.info or console.error.'
        }
      ]
    }
  }
]
