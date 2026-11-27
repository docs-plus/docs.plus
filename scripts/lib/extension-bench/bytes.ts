/**
 * Bytes per variant: the npm ESM file, what a StarterKit app pays for the extension, and a
 * helper-only import. esbuild minify, ESM, browser; Bun zlib level 9 gzip.
 */
import { join } from 'node:path'

import { gzip, loadEsbuild } from './build'
import type { Budget, Bytes, ExtensionBenchConfig, Size, Variant } from './types'

const STARTER_KIT_BASELINE =
  "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';new Editor({extensions:[StarterKit]})"

export async function measureBytes(
  config: ExtensionBenchConfig,
  outDir: string,
  variant: Variant
): Promise<Bytes> {
  const esbuild = await loadEsbuild(config.packageRoot)
  const dist = join(outDir, variant, 'dist', 'index.js')
  const bundle = async (contents: string): Promise<Size> => {
    const result = await esbuild.build({
      stdin: { contents, resolveDir: config.packageRoot, loader: 'js' },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      logLevel: 'error',
      ...(config.externalPackages?.length ? { external: config.externalPackages } : {}),
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [join(config.packageRoot, 'node_modules')],
      plugins: [
        { name: 'variant', setup: (b) => b.onResolve({ filter: /^EXT$/ }, () => ({ path: dist })) }
      ]
    })
    const code = result.outputFiles[0].contents
    return { min: code.length, gz: gzip(code) }
  }

  const starterKit = await bundle(STARTER_KIT_BASELINE)
  const pays = (s: Size): Size => ({ min: s.min - starterKit.min, gz: s.gz - starterKit.gz })
  const esm = await Bun.file(dist).bytes()
  return {
    distEsm: { min: esm.length, gz: gzip(esm) },
    starterKitApp: pays(await bundle(config.starterKitEntry)),
    helperOnly: await bundle(config.helperEntry)
  }
}

/** Checks head's gzip bytes against `bytes-budget.json`. A `null` limit reports without failing. */
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
    if (limit == null) return `- ${key}: ${gz} B, no limit set`
    over ||= gz > limit
    return `- ${key}: ${gz} B, limit ${limit} B${gz > limit ? ', OVER' : ''}`
  })
  return { over, report: `Budget (${file}):\n${lines.join('\n')}` }
}
