/**
 * Builds the three bench variants with the package's real tsup settings: `head` (this working
 * tree), `base` (`src/` at a git ref, default `main`) and `control` (a second copy of `base`).
 * Each lands in OUT/<variant>/ as the npm files plus `rt.js`, which jsdom and the browser load.
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import type { Options } from 'tsup'

import { defineTiptapExtensionConfig } from '../../../../tsup.base'
import { loadEsbuild, OUT, PKG, resolveFromPkg, type Variant, VARIANTS } from './paths'

async function sourceOf(variant: Variant, ref: string): Promise<string> {
  const dir = join(OUT, variant, 'src')
  rmSync(join(OUT, variant), { recursive: true, force: true })
  mkdirSync(join(OUT, variant), { recursive: true })
  if (variant === 'head') {
    cpSync(join(PKG, 'src'), dir, { recursive: true })
    return dir
  }
  // `dir:<path>` takes a saved copy of `src/`, for a "before" that was never committed.
  if (ref.startsWith('dir:')) {
    cpSync(ref.slice(4), dir, { recursive: true })
    return dir
  }
  // `git archive` gives the files of the ref without touching the working tree.
  const tar = Bun.spawnSync(['git', 'archive', ref, 'src'], { cwd: PKG })
  if (tar.exitCode !== 0) throw new Error(`git archive ${ref} failed: ${tar.stderr}`)
  const untar = Bun.spawnSync(['tar', '-x', '-C', join(OUT, variant)], { stdin: tar.stdout })
  if (untar.exitCode !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return dir
}

// The bench builds outside the package, so it passes the externals tsup would read from package.json.
async function tsupBuild(srcDir: string, outDir: string) {
  const { build } = await import(resolveFromPkg('tsup'))
  const pkg = await Bun.file(join(PKG, 'package.json')).json()
  const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]
  const config = defineTiptapExtensionConfig({ external })
  const esbuildOptions: NonNullable<Options['esbuildOptions']> = (options, context) => {
    config.esbuildOptions?.(options, context)
    options.nodePaths = [join(PKG, 'node_modules')]
  }
  await build({
    ...config,
    entry: [join(srcDir, 'index.ts')],
    outDir,
    tsconfig: join(PKG, 'tsconfig.json'),
    dts: false,
    sourcemap: false,
    clean: false,
    silent: true,
    onSuccess: undefined,
    esbuildOptions
  })
}

// rt.js is the ESM dist with absolute import paths, so it loads from the temp folder.
async function runtimeBundle(outDir: string) {
  const esbuild = await loadEsbuild()
  await esbuild.build({
    entryPoints: [join(outDir, 'index.js')],
    outfile: join(outDir, 'rt.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    logLevel: 'error',
    plugins: [
      {
        name: 'absolute-externals',
        setup(b) {
          b.onResolve({ filter: /^(@tiptap\/|linkifyjs$|@floating-ui\/dom$)/ }, (a) => ({
            path: resolveFromPkg(a.path),
            external: true
          }))
        }
      }
    ]
  })
}

export async function buildVariants(ref: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Set NODE_ENV=production, as `bun run build` does.')
  for (const variant of VARIANTS) {
    const src = await sourceOf(variant, ref)
    const out = join(OUT, variant, 'dist')
    await tsupBuild(src, out)
    await runtimeBundle(out)
  }
}
