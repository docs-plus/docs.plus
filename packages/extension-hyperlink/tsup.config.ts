import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
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
    if (isProduction) {
      options.pure = ['console.log', 'console.debug']
    }
  },
  async onSuccess() {
    copyFileSync(resolve('src/styles.css'), resolve('dist/styles.css'))
  }
})
