/**
 * Bytes per variant: the npm ESM file, what a StarterKit app pays for Mermaid at initial load
 * (`pele/*` stays external because it is lazy-loaded on demand), and a helper-only import
 * (`mermaidNodeView`). esbuild minify, ESM, browser; Bun zlib level 9 gzip.
 */
import { join } from 'node:path'

import { gzip, loadEsbuild, OUT, PKG, type Variant } from './paths'

const SK = "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';"

export type Size = { min: number; gz: number }
export type Bytes = {
  distEsm: Size
  starterKitApp: Size
  helperOnly: Size
}

export async function measureBytes(variant: Variant): Promise<Bytes> {
  const esbuild = await loadEsbuild()
  const dist = join(OUT, variant, 'dist', 'index.js')
  const bundle = async (contents: string): Promise<Size> => {
    const result = await esbuild.build({
      stdin: { contents, resolveDir: PKG, loader: 'js' },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      logLevel: 'error',
      // pele/lazy and its diagram chunks load on demand at render time; keep them external so
      // this budget tracks the eager extension entry cost rather than upstream diagram grammars.
      external: ['pele', 'pele/*'],
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [join(PKG, 'node_modules')],
      plugins: [
        { name: 'variant', setup: (b) => b.onResolve({ filter: /^EXT$/ }, () => ({ path: dist })) }
      ]
    })
    const code = result.outputFiles[0].contents
    return { min: code.length, gz: gzip(code) }
  }

  const starterKit = await bundle(`${SK}new Editor({extensions:[StarterKit]})`)
  const pays = (s: Size): Size => ({ min: s.min - starterKit.min, gz: s.gz - starterKit.gz })
  const esm = await Bun.file(dist).bytes()
  return {
    distEsm: { min: esm.length, gz: gzip(esm) },
    starterKitApp: pays(
      await bundle(
        `${SK}import {Mermaid} from 'EXT';new Editor({extensions:[StarterKit,Mermaid.configure()]})`
      )
    ),
    helperOnly: await bundle("import {mermaidNodeView} from 'EXT';console.log(mermaidNodeView)")
  }
}

type Budget = { starterKitAppGz: number | null; helperOnlyGz: number | null }

export async function checkBudget(
  head: Bytes,
  file: string
): Promise<{ over: boolean; report: string }> {
  const budget = (await Bun.file(file).json()) as Budget
  const rows: [keyof Budget, number][] = [
    ['starterKitAppGz', head.starterKitApp.gz],
    ['helperOnlyGz', head.helperOnly.gz]
  ]
  let over = false
  const lines = rows.map(([key, gz]) => {
    const limit = budget[key]
    if (limit === null) return `- ${key}: ${gz} B, no limit set`
    over ||= gz > limit
    return `- ${key}: ${gz} B, limit ${limit} B${gz > limit ? ', OVER' : ''}`
  })
  return { over, report: `Budget (${file}):\n${lines.join('\n')}` }
}
