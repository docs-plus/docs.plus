/**
 * `examples/vanilla` is the StackBlitz twin of the README Quickstart. This fails
 * when the two drift apart; `--write` regenerates the example from the README.
 * Usage: bun scripts/check-quickstart-example.ts [--write] <extension-dir>...
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HEADER = '// The Quickstart from the package README, unchanged.\n'
const args = process.argv.slice(2)
const write = args.includes('--write')
const dirs = args.filter((a) => a !== '--write')
if (dirs.length === 0) {
  console.error('usage: bun scripts/check-quickstart-example.ts [--write] <extension-dir>...')
  process.exit(1)
}

function expected(dir: string): Record<string, string | null> {
  const readme = readFileSync(join('extensions', dir, 'README.md'), 'utf8')
  const section = /\n## Quickstart\n([\s\S]*?)\n## /.exec(readme)?.[1]
  if (!section) throw new Error(`${dir}: README has no Quickstart section`)
  const blocks = [...section.matchAll(/```(\w+)\n([\s\S]*?)```/g)]
  const ts = blocks.filter((b) => b[1] === 'ts').map((b) => b[2].trimEnd() + '\n')
  const css = blocks.filter((b) => b[1] === 'css').map((b) => b[2].trimEnd() + '\n')
  const see = /^You should see.*$/m.exec(section)?.[0]
  if (ts.length === 0 || !see)
    throw new Error(`${dir}: Quickstart needs a ts block and a "You should see" line`)
  const name = `@docs.plus/${dir}`
  const main = HEADER + (css.length ? "import './style.css'\n" : '') + ts.join('\n')
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, sans-serif;
      }
      body {
        max-width: 720px;
        margin: 40px auto;
        padding: 0 16px;
      }
      #editor .ProseMirror {
        min-height: 160px;
        padding: 12px 16px;
        border: 1px solid #9ca3af;
        border-radius: 8px;
        outline: none;
      }
    </style>
  </head>
  <body>
    <h1><code>${name}</code></h1>
    <p>
      ${see.replace(/`([^`]+)`/g, '<code>$1</code>')}
    </p>
    <div id="editor"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
`
  return { 'main.ts': main, 'style.css': css.length ? css.join('\n') : null, 'index.html': html }
}

// Prettier re-wraps the written files, so compare with whitespace collapsed.
const same = (a: string | null, b: string | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim())

let drift = 0
const written: string[] = []
for (const dir of dirs) {
  const root = join('extensions', dir, 'examples', 'vanilla')
  for (const [file, want] of Object.entries(expected(dir))) {
    const path = join(root, file)
    const have = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (same(have, want)) continue
    if (write) {
      if (want === null) rmSync(path)
      else {
        writeFileSync(path, want)
        written.push(path)
      }
      console.log(`wrote ${path}`)
    } else {
      drift++
      console.error(`${path} does not match the README Quickstart`)
    }
  }
}
if (written.length) spawnSync('bunx', ['prettier', '--write', ...written], { stdio: 'inherit' })
if (drift > 0) {
  console.error('Run: bun scripts/check-quickstart-example.ts --write <extension-dir>')
  process.exit(1)
}
console.log(`quickstart example: ${write ? 'written' : 'in sync'} for ${dirs.join(', ')}`)
