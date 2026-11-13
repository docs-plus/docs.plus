/**
 * Shared tsup factory for @docs.plus/extension-* (ESM+CJS, dts, Tiptap externals,
 * prod minify + `pure`-stripped console.log/debug). Overrides are SHALLOW: function-
 * valued options (esbuildOptions / external / dts) replace the base — re-apply the pure
 * strip / re-list externals yourself. Contract: AGENTS.md §Shared Library Config.
 */

import type { Options } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'

export type TiptapExtensionConfigOverrides = Partial<Options> & {
  /**
   * Keeps PURE comments in the production ESM, so an app's bundler can drop unused code.
   * The ESM then keeps its whitespace and grows. The CJS stays fully minified.
   */
  keepPureAnnotations?: boolean
}

// The configs that opted in. The preflight asks `keepsPureAnnotations`, so the option is the one source.
const pureOptIns = new WeakSet<Options>()

/** True for a config built with `keepPureAnnotations: true`. Read by scripts/check-pure-annotations.ts. */
export function keepsPureAnnotations(config: unknown): boolean {
  return typeof config === 'object' && config !== null && pureOptIns.has(config as Options)
}

export function defineTiptapExtensionConfig(
  overrides: TiptapExtensionConfigOverrides = {}
): Options {
  const { keepPureAnnotations = false, ...rest } = overrides
  const config: Options = {
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
    // With `keepPureAnnotations`, esbuildOptions below sets the minify parts per format.
    minify: isProduction && !keepPureAnnotations,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.js' : '.cjs'
      }
    },
    esbuildOptions(options, context) {
      // Strip dev-noise calls in production but preserve `console.warn` /
      // `console.error` — those are the channels the eslint config allows
      // for legitimate runtime signals to consumers.
      if (isProduction) {
        options.pure = ['console.log', 'console.debug']
        if (keepPureAnnotations) {
          // esbuild drops every comment when it minifies whitespace. CJS is not tree-shaken.
          options.minifySyntax = true
          options.minifyIdentifiers = true
          options.minifyWhitespace = context.format === 'cjs'
        }
      }
    },
    ...rest
  }
  if (keepPureAnnotations) pureOptIns.add(config)
  return config
}
