/**
 * Builds `base` (`src/` at a git ref or a published npm tarball) and `head` (this working tree)
 * with the package's real tsup settings. Lands in `<outDir>/<variant>/dist`.
 */
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Options } from 'tsup'

import { type Esbuild, type ExtensionBenchConfig, type Variant, VARIANTS } from './types'

const NPM_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/

export const resolveFromPkg = (packageRoot: string, spec: string): string =>
  Bun.resolveSync(spec, packageRoot)

export const loadEsbuild = async (packageRoot: string): Promise<Esbuild> =>
  (await import(
    Bun.resolveSync('esbuild', dirname(resolveFromPkg(packageRoot, 'tsup')))
  )) as Esbuild

export const gzip = (bytes: Uint8Array): number =>
  Bun.gzipSync(bytes as Uint8Array<ArrayBuffer>, { level: 9 }).length

const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex')

async function npmDist(extensionName: string, outDir: string, version: string): Promise<string> {
  if (!NPM_VERSION.test(version)) throw new Error(`Not a version: ${version}`)
  const meta = await fetch(`https://registry.npmjs.org/${extensionName}/${version}`)
  if (!meta.ok) throw new Error(`registry: ${meta.status} for ${version}`)
  const { dist } = (await meta.json()) as { dist: { tarball: string; integrity: string } }
  const tarball = await fetch(dist.tarball)
  if (!tarball.ok) throw new Error(`registry: ${tarball.status} for ${dist.tarball}`)
  const tgz = new Uint8Array(await tarball.arrayBuffer())
  const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`
  if (integrity !== dist.integrity) throw new Error(`integrity mismatch for ${dist.tarball}`)
  const dir = join(outDir, 'npm')
  mkdirSync(dir, { recursive: true })
  await Bun.write(join(dir, 'package.tgz'), tgz)
  const untar = Bun.spawnSync(['tar', '-xzf', 'package.tgz'], { cwd: dir })
  if (untar.exitCode !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return join(dir, 'package', 'dist')
}

async function sourceOf(
  packageRoot: string,
  outDir: string,
  variant: Variant,
  ref: string
): Promise<string> {
  const dir = join(outDir, variant, 'src')
  rmSync(join(outDir, variant), { recursive: true, force: true })
  mkdirSync(join(outDir, variant), { recursive: true })
  if (variant === 'head') {
    cpSync(join(packageRoot, 'src'), dir, { recursive: true })
    return dir
  }
  if (ref.startsWith('dir:')) {
    cpSync(ref.slice(4), dir, { recursive: true })
    return dir
  }
  const tar = Bun.spawnSync(['git', 'archive', ref, 'src'], { cwd: packageRoot })
  if (tar.exitCode !== 0) throw new Error(`git archive ${ref} failed: ${tar.stderr}`)
  const untar = Bun.spawnSync(['tar', '-x', '-C', join(outDir, variant)], { stdin: tar.stdout })
  if (untar.exitCode !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return dir
}

async function tsupBuild(packageRoot: string, srcDir: string, outDir: string) {
  const mod = (await import(pathToFileURL(join(packageRoot, 'tsup.config.ts')).href)) as {
    default: unknown
  }
  const packageConfig = mod.default
  if (!packageConfig || typeof packageConfig !== 'object' || Array.isArray(packageConfig)) {
    throw new Error('tsup.config.ts must export one options object')
  }
  const { build } = await import(resolveFromPkg(packageRoot, 'tsup'))
  const pkg = await Bun.file(join(packageRoot, 'package.json')).json()
  const external = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {})
  ]
  const config: Options = { ...(packageConfig as Options), external }
  const esbuildOptions: NonNullable<Options['esbuildOptions']> = (options, context) => {
    config.esbuildOptions?.(options, context)
    options.nodePaths = [join(packageRoot, 'node_modules')]
    options.absWorkingDir = dirname(srcDir)
  }
  const cwd = process.cwd()
  process.chdir(dirname(srcDir))
  await build({
    ...config,
    entry: [join(srcDir, 'index.ts')],
    outDir,
    tsconfig: join(packageRoot, 'tsconfig.json'),
    dts: false,
    sourcemap: false,
    clean: false,
    silent: true,
    onSuccess: undefined,
    esbuildOptions
  }).finally(() => process.chdir(cwd))
}

export async function buildVariants(
  config: ExtensionBenchConfig,
  outDir: string,
  ref: string
): Promise<void> {
  // tsup.base.ts reads NODE_ENV at import time; default unset to production before dynamic import.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Set NODE_ENV=production, as `bun run build` does.')
  const published = ref.startsWith('npm:')
    ? await npmDist(config.extensionName, outDir, ref.slice(4))
    : undefined
  for (const variant of VARIANTS) {
    const out = join(outDir, variant, 'dist')
    if (variant === 'base' && published) {
      rmSync(join(outDir, variant), { recursive: true, force: true })
      cpSync(published, out, { recursive: true })
    } else
      await tsupBuild(
        config.packageRoot,
        await sourceOf(config.packageRoot, outDir, variant, ref),
        out
      )
  }
}

export const distSha256 = (outDir: string): Record<Variant, string> =>
  Object.fromEntries(
    VARIANTS.map((v) => [v, sha256(join(outDir, v, 'dist', 'index.js'))])
  ) as Record<Variant, string>
