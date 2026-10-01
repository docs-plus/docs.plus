import nextConfig from '../../packages/eslint-config/next.js'

export default [
  { ignores: ['src/types/supabase.ts'] },
  ...nextConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'tailwind-merge',
              importNames: ['twMerge'],
              message: 'Use @utils/twMerge (it knows text-meta).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/utils/twMerge.ts'],
    rules: { 'no-restricted-imports': 'off' }
  }
]
