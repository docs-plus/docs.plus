/**
 * Shared tsup config factory for the `@docs.plus/extension-*` Tiptap
 * extension packages.
 *
 * Each `packages/extension-*` package builds the same shape (ESM + CJS, dts,
 * Tiptap as peer/external, prod-only sourcemaps/minify). This factory captures
 * that shape so individual packages only declare what's actually different
 * (e.g. extension-hyperlink also copies `styles.css` into dist).
 *
 * The `define*` verb form mirrors tsup's own `defineConfig` convention so
 * it's discoverable; the `TiptapExtension` qualifier is honest about the
 * scope — the factory hardcodes `@tiptap/core` and `@tiptap/pm` as
 * externals, so it is **not** a generic library factory.
 *
 * Usage in a package's `tsup.config.ts`:
 *
 *   import { defineConfig } from 'tsup'
 *   import { defineTiptapExtensionConfig } from '../../tsup.base'
 *
 *   export default defineConfig(defineTiptapExtensionConfig())
 *
 * With overrides:
 *
 *   export default defineConfig(
 *     defineTiptapExtensionConfig({
 *       async onSuccess() {
 *         copyFileSync('src/styles.css', 'dist/styles.css')
 *       }
 *     })
 *   )
 *
 * ## Override semantics — shallow spread, NOT deep merge
 *
 * `overrides` is shallow-spread over the base `Options` object. That means
 * nested function-valued options replace the base entirely:
 *
 *   - Overriding `esbuildOptions` → drops the base's `pure` directive, so
 *     `console.log` / `console.debug` will survive into the production
 *     bundle. If you need to override, copy the base body and call it
 *     yourself, e.g.:
 *
 *       defineTiptapExtensionConfig({
 *         esbuildOptions(options) {
 *           if (process.env.NODE_ENV === 'production') {
 *             options.pure = ['console.log', 'console.debug']
 *           }
 *           options.banner = { js: '// my-pkg' }
 *         }
 *       })
 *
 *   - Overriding `external` → drops `@tiptap/core` / `@tiptap/pm` from
 *     externals; you must re-list them.
 *
 *   - Overriding `dts` → drops `resolve: true`.
 *
 * Today only `extension-hyperlink` uses an override (`onSuccess`, which the
 * base doesn't define) so the shallow spread is safe. Add a deep-merge layer
 * the day a second caller actually needs it — not before.
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
