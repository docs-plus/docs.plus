// Base ESLint config for all packages
const js = require('@eslint/js')
const tseslint = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const prettier = require('eslint-config-prettier')
const globals = require('globals')

module.exports = [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      // Dependencies & Build outputs
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',

      // Config files (JS configs shouldn't lint themselves)
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
      'eslint.config.js',

      // Next.js
      '**/next-env.d.ts',
      '**/public/**',

      // Test files (if you want to lint tests, remove these)
      '**/cypress/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',

      // Misc
      '**/*.min.js',
      '**/workbox-*.js'
    ]
  },

  // Base config
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        Bun: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-console': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Import sorting - auto-fixable
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // JavaScript files (config files, etc.)
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        Bun: 'readonly'
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // Warn about JS files in src directories - prefer TypeScript
  {
    files: ['**/src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Program',
          message:
            'JavaScript files in src/ should be converted to TypeScript (.ts/.tsx). This project uses TypeScript.'
        }
      ]
    }
  },

  // Prettier - must be last
  prettier
]
