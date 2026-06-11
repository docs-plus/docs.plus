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
  const gates = process.argv[2] === '--gates'

  for (const { dir, hasUnit } of PUBLISHABLE_EXTENSIONS) {
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
