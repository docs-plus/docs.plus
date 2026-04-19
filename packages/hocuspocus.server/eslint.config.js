import baseConfig from '../eslint-config/index.js'

export default [
  ...baseConfig,

  // link-metadata module: domain layer must not import infra SDKs.
  // Keeps the module extractable as a microservice (boundary rule 4).
  {
    files: ['src/modules/link-metadata/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['hono', 'hono/**'], message: 'domain/ must be framework-free' },
            {
              group: ['ioredis', 'ioredis/**'],
              message: 'domain/ must not import ioredis; use the Cache port'
            },
            {
              group: ['metascraper', 'metascraper-*', 'metascraper-*/**'],
              message: 'domain/ must not import metascraper; use the Scraper port'
            }
          ]
        }
      ]
    }
  },

  // link-metadata module: code outside the module must not reach into its internals.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/modules/link-metadata/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/link-metadata/*', '**/modules/link-metadata/**/*'],
              message: 'Import from "./modules/link-metadata" only — internals are private.'
            }
          ]
        }
      ]
    }
  }
]
