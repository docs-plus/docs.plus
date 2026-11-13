/**
 * Fails when a bare `import '<pkg>'` of an opted-in package's ESM dist still leaves code (#774).
 * Fails closed on a missing or empty dist, zero `__PURE__` comments, or a build error.
 * Skips a package whose tsup.config.ts does not pass `keepPureAnnotations: true`.
 * Usage: bun scripts/check-pure-annotations.ts --tmp <empty folder> <package-dir>...
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { keepsPureAnnotations } from '../tsup.base'

const args = process.argv.slice(2)
const tmpAt = args.indexOf('--tmp')
const tmp = tmpAt === -1 ? undefined : args[tmpAt + 1]
const dirs = args.filter((_, i) => i !== tmpAt && i !== tmpAt + 1)
if (!tmp || dirs.length === 0) {
  console.error('usage: bun scripts/check-pure-annotations.ts --tmp <folder> <package-dir>...')
  process.exit(1)
}

async function check(dir: string, work: string): Promise<string[]> {
  const pkg = await Bun.file(join(dir, 'package.json')).json()
  const dist = Bun.file(join(dir, 'dist', 'index.js'))
  if (!(await dist.exists())) throw new Error('dist/index.js is missing')
  const text = await dist.text()
  if (text.trim() === '') throw new Error('dist/index.js is empty')
  const reasons = text.includes('__PURE__') ? [] : ['dist/index.js has zero __PURE__ comments']

  // The package's own `sideEffects` would let the bundler drop the file and pass by accident.
  mkdirSync(work, { recursive: true })
  copyFileSync(join(dir, 'dist', 'index.js'), join(work, 'subject.js'))
  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'pure-guard', type: 'module' }))
  writeFileSync(join(work, 'entry.js'), "import './subject.js'\n")
  const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]
  const result = await Bun.build({
    entrypoints: [join(work, 'entry.js')],
    external: deps.flatMap((d) => [d, `${d}/*`]),
    minify: true,
    target: 'browser',
    format: 'esm'
  })
  if (!result.success) throw new Error(result.logs.map(String).join('; '))
  const out = await result.outputs[0].text()
  // Bun keeps the imports of externals; anything else left is code that runs at load.
  const left = out.replace(/import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'][^"']+["'];?/g, '').trim()
  if (left.length > 0)
    reasons.push(`${left.length} B of code survive a bare import: ${left.slice(0, 200)}`)
  return reasons
}

let failed = false
for (const [i, dir] of dirs.entries()) {
  try {
    const config = (await import(resolve(dir, 'tsup.config.ts'))).default
    if (!keepsPureAnnotations(config)) {
      console.log(`pure annotations ${dir}: skipped, the package does not opt in`)
      continue
    }
    const reasons = await check(dir, join(tmp, String(i)))
    for (const reason of reasons) console.error(`error: ${dir}: ${reason}`)
    if (reasons.length > 0) failed = true
    else console.log(`pure annotations ${dir}: a bare import leaves no code`)
  } catch (error) {
    failed = true
    console.error(`error: ${dir}: ${(error as Error).message}`)
  }
}
process.exit(failed ? 1 : 0)
