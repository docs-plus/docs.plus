/**
 * Bytes per variant: the npm ESM file, what a StarterKit app pays for Hyperlink, and a helper-only
 * import. esbuild minify, ESM, browser; Bun zlib level 9 for every gzip figure, so rows compare.
 */
import { join } from 'node:path'

import { gzip, loadEsbuild, OUT, PKG, type Variant } from './paths'

const APPS = {
  starterKit:
    "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';new Editor({extensions:[StarterKit]})",
  starterKitHyperlink:
    "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';import {Hyperlink} from 'HL';new Editor({extensions:[StarterKit.configure({link:false}),Hyperlink.configure({})]})",
  helperOnly: "import {normalizeHref} from 'HL';console.log(normalizeHref)"
}

export type Size = { min: number; gz: number }
export type Bytes = { distEsm: Size; starterKitApp: Size; helperOnly: Size }

export async function measureBytes(variant: Variant): Promise<Bytes> {
  const esbuild = await loadEsbuild()
  const dist = join(OUT, variant, 'dist', 'index.js')
  const sizes = {} as Record<keyof typeof APPS, Size>
  for (const [name, contents] of Object.entries(APPS) as [keyof typeof APPS, string][]) {
    const result = await esbuild.build({
      stdin: { contents, resolveDir: PKG, loader: 'js' },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"production"' },
      // The dist lives in the temp folder, so its imports resolve from the package.
      nodePaths: [join(PKG, 'node_modules')],
      plugins: [
        { name: 'variant', setup: (b) => b.onResolve({ filter: /^HL$/ }, () => ({ path: dist })) }
      ]
    })
    const code = result.outputFiles[0].contents
    sizes[name] = { min: code.length, gz: gzip(code) }
  }
  const esm = await Bun.file(dist).bytes()
  return {
    distEsm: { min: esm.length, gz: gzip(esm) },
    starterKitApp: {
      min: sizes.starterKitHyperlink.min - sizes.starterKit.min,
      gz: sizes.starterKitHyperlink.gz - sizes.starterKit.gz
    },
    helperOnly: sizes.helperOnly
  }
}
