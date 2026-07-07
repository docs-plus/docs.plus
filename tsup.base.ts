/**
 * Shared tsup factory for @docs.plus/extension-* (ESM+CJS, dts, Tiptap externals,
 * prod minify + `pure`-stripped console.log/debug). Overrides are SHALLOW: function-
 * valued options (esbuildOptions / external / dts) replace the base — re-apply the pure
 * strip / re-list externals yourself. Contract: AGENTS.md §Shared Library Config.
 */

import type { Options } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'

export function defineTiptapExtensionConfig(overrides: Partial<Options> = {}): Options {
  return {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    external: ['@tiptap/core', '@tiptap/pm'],
    dts: {
      entry: './src/index.ts',
      resolve: true
    },
    sourcemap: isProduction,
    clean: isProduction,
    minify: isProduction,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.js' : '.cjs'
      }
    },
    esbuildOptions(options) {
      // Strip dev-noise calls in production but preserve `console.warn` /
      // `console.error` — those are the channels the eslint config allows
      // for legitimate runtime signals to consumers.
      if (isProduction) {
        options.pure = ['console.log', 'console.debug']
      }
    },
    ...overrides
  }
}
