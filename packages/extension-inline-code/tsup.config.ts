import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  external: ['@tiptap/core', '@tiptap/pm'],
  dts: {
    entry: './src/index.ts',
    resolve: true
  },
  clean: true,
  minify: true,
  sourcemap: true,
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.js' : format === 'cjs' ? '.cjs' : '.umd.js'
    }
  },
  globalName: 'DocsplusExtensionInlineCode'
})
