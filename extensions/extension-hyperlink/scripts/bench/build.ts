/**
 * Builds the three bench variants with the package's real tsup settings: `head` (this working
 * tree), `base` (`src/` at a git ref, default `main`, or a published tarball) and `control` (a
 * copy of the `base` dist). Each lands in OUT/<variant>/ as the npm files plus `rt.js`.
 */
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Options } from 'tsup'

import packageConfig from '../../tsup.config'
import {
  loadEsbuild,
  NPM_VERSION,
  OUT,
  PKG,
  resolveFromPkg,
  sha256,
  type Variant,
  VARIANTS
} from './paths'

// The published file, not a rebuild: the registry tarball, checked against the registry's integrity.
async function npmDist(version: string): Promise<string> {
  if (!NPM_VERSION.test(version)) throw new Error(`Not a version: ${version}`)
  const meta = await fetch(`https://registry.npmjs.org/@docs.plus/extension-hyperlink/${version}`)
  if (!meta.ok) throw new Error(`registry: ${meta.status} for ${version}`)
  const { dist } = (await meta.json()) as { dist: { tarball: string; integrity: string } }
  const tarball = await fetch(dist.tarball)
  if (!tarball.ok) throw new Error(`registry: ${tarball.status} for ${dist.tarball}`)
  const tgz = new Uint8Array(await tarball.arrayBuffer())
  const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`
  if (integrity !== dist.integrity) throw new Error(`integrity mismatch for ${dist.tarball}`)
  const dir = join(OUT, 'npm')
  mkdirSync(dir, { recursive: true })
  await Bun.write(join(dir, 'package.tgz'), tgz)
  const untar = Bun.spawnSync(['tar', '-xzf', 'package.tgz'], { cwd: dir })
  if (untar.exitCode !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return join(dir, 'package', 'dist')
}

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

// A built variant uses this tree's tsup config, so a git-ref `base` is its `src/`, not its npm file.
async function tsupBuild(srcDir: string, outDir: string) {
  if (typeof packageConfig === 'function' || Array.isArray(packageConfig))
    throw new Error('tsup.config.ts must export one options object')
  const { build } = await import(resolveFromPkg('tsup'))
  const pkg = await Bun.file(join(PKG, 'package.json')).json()
  // The bench builds outside the package, so it passes the externals tsup would read from package.json.
  const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]
  // The package's own config, so opt-ins such as `keepPureAnnotations` match the shipped dist.
  const config: Options = { ...packageConfig, external }
  const esbuildOptions: NonNullable<Options['esbuildOptions']> = (options, context) => {
    config.esbuildOptions?.(options, context)
    options.nodePaths = [join(PKG, 'node_modules')]
    // tsup turns the entry into a path relative to process.cwd(). esbuild keeps the working folder
    // it started in, so without this every variant would build this tree's src/.
    options.absWorkingDir = dirname(srcDir)
  }
  // esbuild writes `// <path>` comments relative to the working folder. From the variant folder
  // they read `// src/…`, as in the npm file, and stay the same from run to run.
  const cwd = process.cwd()
  process.chdir(dirname(srcDir))
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
  }).finally(() => process.chdir(cwd))
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

// `control` copies the `base` dist, so the A/A pair runs byte-identical code.
export async function buildVariants(ref: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Set NODE_ENV=production, as `bun run build` does.')
  const published = ref.startsWith('npm:') ? await npmDist(ref.slice(4)) : undefined
  for (const variant of VARIANTS) {
    const out = join(OUT, variant, 'dist')
    if (variant === 'control' || (variant === 'base' && published)) {
      rmSync(join(OUT, variant), { recursive: true, force: true })
      cpSync(variant === 'control' ? join(OUT, 'base', 'dist') : published!, out, {
        recursive: true
      })
    } else await tsupBuild(await sourceOf(variant, ref), out)
    await runtimeBundle(out)
  }
}

export const distSha256 = (): Record<Variant, string> =>
  Object.fromEntries(VARIANTS.map((v) => [v, sha256(join(OUT, v, 'dist', 'index.js'))])) as Record<
    Variant,
    string
  >
