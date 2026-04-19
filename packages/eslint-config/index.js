// Base ESLint config — TypeScript + Prettier, no framework plugins.
// Used directly by: root, hocuspocus
// Extended by: next.js (adds React), library.js (adds strictness)
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

const sharedGlobals = { ...globals.browser, ...globals.node, ...globals.es2021, Bun: 'readonly' }

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/lcov-report/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
      'eslint.config.js',
      '**/next-env.d.ts',
      '**/public/**',
      '**/cypress/**',
      '**/*.test.{ts,tsx,js}',
      '**/*.spec.{ts,tsx,js}',
      '**/__tests__/**',
      '**/*.min.js',
      '**/workbox-*.js'
    ]
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: sharedGlobals }
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: sharedGlobals
    },
    plugins: { '@typescript-eslint': tseslint, 'simple-import-sort': simpleImportSort },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-undef': 'off',
      'no-console': 'off',
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn'
    }
  },

  prettier
]
