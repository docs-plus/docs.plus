import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Paths and tools the byte bench shares. Builds go to the OS temp folder, never into the repo. */
export const PKG = join(import.meta.dir, '../..')
export const OUT = realpathSync(mkdtempSync(join(tmpdir(), 'docsplus-hypermultimedia-bench-')))
process.on('exit', () => rmSync(OUT, { recursive: true, force: true }))
export const VARIANTS = ['base', 'head'] as const
export const NPM_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/
export type Variant = (typeof VARIANTS)[number]

type ResolveArgs = { path: string }
export type EsbuildPlugin = {
  name: string
  setup: (build: {
    onResolve: (
      options: { filter: RegExp },
      callback: (args: ResolveArgs) => { path: string; external?: boolean }
    ) => void
  }) => void
}
type Esbuild = {
  build: (options: Record<string, unknown> & { plugins?: EsbuildPlugin[] }) => Promise<{
    outputFiles: { contents: Uint8Array; text: string }[]
  }>
}

export const resolveFromPkg = (spec: string): string => Bun.resolveSync(spec, PKG)
export const loadEsbuild = async (): Promise<Esbuild> =>
  (await import(Bun.resolveSync('esbuild', dirname(resolveFromPkg('tsup'))))) as Esbuild
export const gzip = (bytes: Uint8Array): number =>
  Bun.gzipSync(bytes as Uint8Array<ArrayBuffer>, { level: 9 }).length
export const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex')
