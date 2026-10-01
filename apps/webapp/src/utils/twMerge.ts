import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The only twMerge in the webapp. It knows the `--text-meta` size in `globals.scss` `@theme`.
 * Stock tailwind-merge reads `text-meta` as a colour and drops `text-primary` beside it.
 * ESLint blocks the stock `twMerge` import; use this one.
 */
export const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['meta'] } }
})
