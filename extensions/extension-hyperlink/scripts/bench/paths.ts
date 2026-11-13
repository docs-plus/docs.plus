import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Paths and tools the bench shares. Builds go to the OS temp folder, never into the repo. */
export const PKG = join(import.meta.dir, '../..')
// One folder per run, so two runs never overwrite each other's builds.
export const OUT = realpathSync(mkdtempSync(join(tmpdir(), 'docsplus-hyperlink-bench-')))
process.on('exit', () => rmSync(OUT, { recursive: true, force: true }))
export const VARIANTS = ['base', 'control', 'head'] as const
export const NPM_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/
export type Variant = (typeof VARIANTS)[number]

// esbuild is not a dependency of this package, so its types are not either. These cover what the bench uses.
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
// The esbuild that tsup uses, so the bench and the package build share one version.
export const loadEsbuild = async (): Promise<Esbuild> =>
  (await import(Bun.resolveSync('esbuild', dirname(resolveFromPkg('tsup'))))) as Esbuild
export const gzip = (bytes: Uint8Array): number =>
  Bun.gzipSync(bytes as Uint8Array<ArrayBuffer>, { level: 9 }).length
export const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex')
export const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
