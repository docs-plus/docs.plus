/** SSOT for release-family, CI, and run-tests.sh extension gates. */

export const PUBLISHABLE_EXTENSIONS = [
  { dir: 'extension-indent', hasUnit: true },
  { dir: 'extension-hyperlink', hasUnit: true },
  { dir: 'extension-hypermultimedia', hasUnit: false },
  { dir: 'extension-inline-code', hasUnit: false },
  { dir: 'extension-placeholder', hasUnit: false }
] as const

export type PublishableExtensionDir = (typeof PUBLISHABLE_EXTENSIONS)[number]['dir']

export const PUBLISHABLE_EXTENSION_DIRS: readonly PublishableExtensionDir[] =
  PUBLISHABLE_EXTENSIONS.map((ext) => ext.dir)

if (import.meta.main) {
  const args = process.argv.slice(2)
  const gates = args.includes('--gates')

  const onlyArgs = args.flatMap((a, i, arr) => (a === '--only' ? [arr[i + 1]] : []))
  let selected: ReadonlyArray<{ readonly dir: string; readonly hasUnit: boolean }>

  if (onlyArgs.length > 0) {
    const normalizeExt = (v: string) => v.replace(/^@docs\.plus\//, '')
    const want = new Set(onlyArgs.map(normalizeExt))
    const known = new Set(PUBLISHABLE_EXTENSIONS.map((e) => e.dir))
    for (const w of want) {
      if (!known.has(w)) {
        console.error(`unknown extension '${w}'. valid: ${[...known].join(', ')}`)
        process.exit(1)
      }
    }
    selected = PUBLISHABLE_EXTENSIONS.filter((e) => want.has(e.dir))
  } else {
    selected = PUBLISHABLE_EXTENSIONS
  }

  for (const { dir, hasUnit } of selected) {
    if (gates) {
      const note = hasUnit ? 'Jest + clean-room Cypress' : 'clean-room Cypress'
      process.stdout.write(
        `extensions/${dir}\t${hasUnit ? '1' : '0'}\t@docs.plus/${dir} (${note})\n`
      )
    } else {
      process.stdout.write(`${dir}\n`)
    }
  }

  process.exit(0)
}
