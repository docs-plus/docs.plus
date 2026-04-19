// ESLint config for Next.js / React apps (extends base + adds React)
// Used by: webapp, admin-dashboard
import baseConfig from './index.js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  ...baseConfig,

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-document-import-in-page': 'off',
      'no-fallthrough': ['error', { commentPattern: 'falls through' }],
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name!=/^(info|warn|error|log|debug)$/]",
          message: 'Prefer console.info, console.warn, or console.error in production code.'
        }
      ]
    },
    settings: { react: { version: 'detect' } }
  },

  {
    files: ['**/logger.ts', '**/logger.js', '**/utils/logger.*'],
    rules: { 'no-restricted-syntax': 'off' }
  }
]
