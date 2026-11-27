/**
 * Builds `base` (`src/` at a git ref or a published npm tarball) and `head` (this working tree)
 * with the package's real tsup settings. Lands in OUT/<variant>/dist.
 */
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Options } from 'tsup'

import packageConfig from '../../tsup.config'
import { NPM_VERSION, OUT, PKG, resolveFromPkg, sha256, type Variant, VARIANTS } from './paths'

async function npmDist(version: string): Promise<string> {
  if (!NPM_VERSION.test(version)) throw new Error(`Not a version: ${version}`)
  const meta = await fetch(`https://registry.npmjs.org/@docs.plus/extension-mermaid/${version}`)
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
  if (ref.startsWith('dir:')) {
    cpSync(ref.slice(4), dir, { recursive: true })
    return dir
  }
  const tar = Bun.spawnSync(['git', 'archive', ref, 'src'], { cwd: PKG })
  if (tar.exitCode !== 0) throw new Error(`git archive ${ref} failed: ${tar.stderr}`)
  const untar = Bun.spawnSync(['tar', '-x', '-C', join(OUT, variant)], { stdin: tar.stdout })
  if (untar.exitCode !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return dir
}

async function tsupBuild(srcDir: string, outDir: string) {
  if (typeof packageConfig === 'function' || Array.isArray(packageConfig))
    throw new Error('tsup.config.ts must export one options object')
  const { build } = await import(resolveFromPkg('tsup'))
  const pkg = await Bun.file(join(PKG, 'package.json')).json()
  const external = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {})
  ]
  const config: Options = { ...packageConfig, external }
  const esbuildOptions: NonNullable<Options['esbuildOptions']> = (options, context) => {
    config.esbuildOptions?.(options, context)
    options.nodePaths = [join(PKG, 'node_modules')]
    options.absWorkingDir = dirname(srcDir)
  }
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

export async function buildVariants(ref: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Set NODE_ENV=production, as `bun run build` does.')
  const published = ref.startsWith('npm:') ? await npmDist(ref.slice(4)) : undefined
  for (const variant of VARIANTS) {
    const out = join(OUT, variant, 'dist')
    if (variant === 'base' && published) {
      rmSync(join(OUT, variant), { recursive: true, force: true })
      cpSync(published, out, { recursive: true })
    } else await tsupBuild(await sourceOf(variant, ref), out)
  }
}

export const distSha256 = (): Record<Variant, string> =>
  Object.fromEntries(VARIANTS.map((v) => [v, sha256(join(OUT, v, 'dist', 'index.js'))])) as Record<
    Variant,
    string
  >
