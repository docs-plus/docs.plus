/**
 * What an npm user's app pays: builds examples/vanilla with Vite against the published tarball and
 * against `bun pm pack` of this package, in temp copies, and prints the bundle delta. Release time only.
 * Usage: bun scripts/bench/consumer-bytes.ts [--version 2.3.0]. It packs dist/ as it is: build first.
 */
/* eslint-disable no-console -- a CLI that prints its report */
import { cpSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import type { Size } from './bytes'
import { gzip, NPM_VERSION, OUT, PKG } from './paths'
import { n, signed } from './table'

const { values } = parseArgs({ options: { version: { type: 'string', default: '2.3.0' } } })
const version = values.version!
if (!NPM_VERSION.test(version)) throw new Error(`Not a version: ${version}`)
const NAME = '@docs.plus/extension-hyperlink'

const run = (cmd: string[], cwd: string): string => {
  const p = Bun.spawnSync(cmd, { cwd, stderr: 'pipe' })
  if (p.exitCode !== 0) throw new Error(`${cmd.join(' ')} failed in ${cwd}:\n${p.stderr}`)
  return p.stdout.toString()
}
const newest = (dir: string): number =>
  Math.max(
    ...readdirSync(dir, { recursive: true, encoding: 'utf8' }).map(
      (f) => statSync(join(dir, f)).mtimeMs
    )
  )

// `bun pm pack` packs dist/ as it is, so a dist older than src/ would measure old code.
if (newest(join(PKG, 'dist')) < newest(join(PKG, 'src')))
  throw new Error('dist/ is older than src/. Run `bun run build` first.')
// --ignore-scripts skips prepack, which would copy LICENSE into the package folder.
const packed = run(['bun', 'pm', 'pack', '--ignore-scripts', '--quiet', '--destination', OUT], PKG)
const tarball = packed.trim().split('\n').pop()!
const manifest = run(['tar', '-xzOf', tarball, 'package/package.json'], OUT)
if (/"(catalog|workspace):/.test(manifest))
  throw new Error('The packed package.json is not resolved.')

async function buildApp(side: string, spec: string) {
  const app = join(OUT, side)
  cpSync(join(PKG, 'examples/vanilla'), app, { recursive: true })
  const pkg = await Bun.file(join(app, 'package.json')).json()
  pkg.dependencies[NAME] = spec
  await Bun.write(join(app, 'package.json'), JSON.stringify(pkg, null, 2))
  run(['bun', 'install', '--ignore-scripts'], app)
  run(['bun', 'run', 'build'], app)
  const versions: Record<string, string> = {}
  for (const dep of [
    '@tiptap/core',
    '@tiptap/pm',
    '@tiptap/starter-kit',
    'linkifyjs',
    '@floating-ui/dom',
    'vite'
  ])
    versions[dep] = (await Bun.file(join(app, 'node_modules', dep, 'package.json')).json()).version
  const sizes = { js: { min: 0, gz: 0 }, css: { min: 0, gz: 0 } }
  for (const file of readdirSync(join(app, 'dist/assets'))) {
    const kind = file.endsWith('.js') ? sizes.js : file.endsWith('.css') ? sizes.css : undefined
    if (!kind) continue
    const bytes = await Bun.file(join(app, 'dist/assets', file)).bytes()
    kind.min += bytes.length
    kind.gz += gzip(bytes)
  }
  return { versions, sizes }
}

const published = await buildApp('published', version)
const head = await buildApp('head', `file:${tarball}`)
// Same peers, dependencies and Vite on both sides, so the delta is the extension alone.
if (JSON.stringify(published.versions) !== JSON.stringify(head.versions))
  throw new Error(
    `Resolved versions differ: ${JSON.stringify([published.versions, head.versions])}`
  )

const row = (label: string, a: Size, b: Size) =>
  `| ${label} | ${n(a.min)} / ${n(a.gz)} | ${n(b.min)} / ${n(b.gz)} | ${signed(b.min - a.min)} / ${signed(b.gz - a.gz)} |`
console.log(
  `examples/vanilla, Vite ${published.versions.vite}, @tiptap/core ${published.versions['@tiptap/core']}. Gzip: Bun zlib level 9 per file.\n`
)
console.log(
  `| Vite app (min / gz) | ${version} | head (packed) | Change |\n| --- | --- | --- | --- |`
)
console.log(row('JS', published.sizes.js, head.sizes.js))
console.log(row('CSS', published.sizes.css, head.sizes.css))
