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
    // TocItemBody.tsx imports tailwind-merge directly; drop it here once it uses @utils/twMerge.
    files: ['src/utils/twMerge.ts', 'src/components/toc/TocItemBody.tsx'],
    rules: { 'no-restricted-imports': 'off' }
  }
]
