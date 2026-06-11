#!/usr/bin/env bun
/** `docs-playground --entry <main.ts> --port <n>` — temp-dir shell + symlinked consumer fixture for Bun's HTML bundler. Consumer main.ts must use package imports only. */
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const entry = flag('entry')
const port = Number(flag('port'))
const readmeMediaDir = flag('readme-media-dir')
if (!entry || !Number.isInteger(port)) {
  throw new Error(
    'usage: docs-playground --entry <main.ts> --port <number> [--readme-media-dir <dir>]'
  )
}

const shellCss = readFileSync(join(import.meta.dir, 'shell.css'), 'utf8')

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>docs.plus — clean-room playground</title>
    <style>${shellCss}</style>
    <script>
      // Resolve the theme before first paint (persisted, else system) and always
      // set data-theme so the shell and the extension's token blocks match with
      // no light→dark flash.
      ;(function () {
        var t = null
        try {
          t = localStorage.getItem('theme')
        } catch (_) {}
        if (t !== 'dark' && t !== 'light') {
          t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        document.documentElement.setAttribute('data-theme', t)
      })()
    </script>
  </head>
  <body>
    <main>
      <div class="header">
        <h1></h1>
        <button id="theme-toggle" class="theme-toggle" type="button"></button>
      </div>
      <div id="editor"></div>
    </main>
    <footer class="footer">
      <a id="playground-github" href="https://github.com/docs-plus/docs.plus" target="_blank" rel="noopener noreferrer">GitHub</a>
      ·
      <a href="https://discord.gg/25JPG38J59" target="_blank" rel="noopener noreferrer">Discord</a>
    </footer>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`

const dir = mkdtempSync(join(tmpdir(), 'docs-playground-'))
symlinkSync(resolve(entry), join(dir, 'main.ts'))
writeFileSync(join(dir, 'index.html'), html)

const index = await import(join(dir, 'index.html'))
const readmeMediaRoot = readmeMediaDir ? resolve(readmeMediaDir) : null

function serveReadmeMedia(req: Request): Response {
  const rel = decodeURIComponent(new URL(req.url).pathname.slice('/readme-media/'.length))
  if (!rel || rel.includes('..')) {
    return new Response('Forbidden', { status: 403 })
  }
  const filePath = join(readmeMediaRoot!, rel)
  if (!filePath.startsWith(readmeMediaRoot!)) {
    return new Response('Forbidden', { status: 403 })
  }
  return new Response(Bun.file(filePath))
}

const server = Bun.serve({
  port,
  hostname: '127.0.0.1',
  routes: {
    '/': index.default,
    ...(readmeMediaRoot ? { '/readme-media/*': serveReadmeMedia } : {})
  },
  development: true
})

// eslint-disable-next-line no-console -- startup banner for the dev playground
console.log(`Playground listening on ${server.url}`)

let shuttingDown = false
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return
  shuttingDown = true
  // eslint-disable-next-line no-console -- shutdown banner for the dev playground
  console.log(`\nReceived ${signal}, shutting down playground…`)
  await server.stop()
  rmSync(dir, { recursive: true, force: true })
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => void shutdown(signal))
}
