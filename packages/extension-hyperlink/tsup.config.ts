import { defineConfig } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
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
      js: format === 'esm' ? '.js' : format === 'cjs' ? '.cjs' : '.umd.js'
    }
  },
  esbuildOptions(options) {
    // Only preserve console logs in development
    options.drop = isProduction ? ['console'] : []
  },
  globalName: 'DocsplusExtensionHyperlink'
})
