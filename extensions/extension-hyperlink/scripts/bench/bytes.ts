/**
 * Bytes per variant: the npm ESM file, what a StarterKit app pays for each mark, and a helper-only
 * import. esbuild minify, ESM, browser; Bun zlib level 9 for every gzip figure, so rows compare.
 */
import { join } from 'node:path'

import { gzip, loadEsbuild, OUT, PKG, type Variant } from './paths'

const SK = "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';"
// Three own slots, the way an app that draws its own forms configures the mark.
const SLOTS =
  'const f=()=>document.createElement("div");const popovers={previewHyperlink:f,editHyperlink:f,createHyperlink:f};'
const app = (mark: string, slots: boolean) =>
  `${SK}import {${mark}} from 'HL';${slots ? SLOTS : ''}new Editor({extensions:[StarterKit.configure({link:false}),${mark}.configure({${slots ? 'popovers' : ''}})]})`

export type Size = { min: number; gz: number }
// The slot and `HyperlinkBase` rows are optional: a ref before #775 has no `HyperlinkBase`.
export type Bytes = {
  distEsm: Size
  starterKitApp: Size
  slotsApp?: Size
  baseApp?: Size
  baseSlotsApp?: Size
  helperOnly: Size
}

export async function measureBytes(variant: Variant): Promise<Bytes> {
  const esbuild = await loadEsbuild()
  const dist = join(OUT, variant, 'dist', 'index.js')
  const bundle = async (
    contents: string,
    logLevel: 'error' | 'silent' = 'error'
  ): Promise<Size> => {
    const result = await esbuild.build({
      stdin: { contents, resolveDir: PKG, loader: 'js' },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      logLevel,
      define: { 'process.env.NODE_ENV': '"production"' },
      // The dist lives in the temp folder, so its imports resolve from the package.
      nodePaths: [join(PKG, 'node_modules')],
      plugins: [
        { name: 'variant', setup: (b) => b.onResolve({ filter: /^HL$/ }, () => ({ path: dist })) }
      ]
    })
    const code = result.outputFiles[0].contents
    return { min: code.length, gz: gzip(code) }
  }
  // A ref without the export fails to bundle; its row then shows `—`.
  const optional = (contents: string) => bundle(contents, 'silent').catch(() => undefined)

  const starterKit = await bundle(`${SK}new Editor({extensions:[StarterKit]})`)
  const pays = (s: Size): Size => ({ min: s.min - starterKit.min, gz: s.gz - starterKit.gz })
  const paysIfBuilt = (s: Size | undefined) => s && pays(s)
  const esm = await Bun.file(dist).bytes()
  return {
    distEsm: { min: esm.length, gz: gzip(esm) },
    starterKitApp: pays(await bundle(app('Hyperlink', false))),
    slotsApp: paysIfBuilt(await optional(app('Hyperlink', true))),
    baseApp: paysIfBuilt(await optional(app('HyperlinkBase', false))),
    baseSlotsApp: paysIfBuilt(await optional(app('HyperlinkBase', true))),
    helperOnly: await bundle("import {normalizeHref} from 'HL';console.log(normalizeHref)")
  }
}

type Budget = { starterKitAppGz: number | null; helperOnlyGz: number | null }

/** Checks head's gzip bytes against the budget file. A `null` limit is not set yet, so it passes. */
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
