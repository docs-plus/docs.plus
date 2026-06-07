/**
 * Clean-room playground server for @docs.plus/extension-hyperlink.
 *
 * Bun-native replacement for the previous Vite dev server. Using
 * `Bun.serve({ routes: { '/': index } })` with an HTML import means Bun
 * bundles the referenced `<script>` and `<link>` tags (TypeScript + CSS)
 * on demand — no config, no plugins, no dedupe knobs. The CSS + JS come
 * from `@docs.plus/extension-hyperlink`'s published exports map, so the
 * Cypress suite exercises the same artifact a fresh npm consumer gets.
 */

import index from './index.html'

const server = Bun.serve({
  port: 5173,
  hostname: '127.0.0.1',
  routes: { '/': index },
  development: true
})

// eslint-disable-next-line no-console -- startup banner for the dev playground
console.log(`Playground listening on ${server.url}`)

/**
 * Graceful shutdown: stop accepting new connections, let in-flight requests
 * drain, then exit. Without this, Ctrl+C leaves the socket in TIME_WAIT and
 * the next `bun run playground` fails with EADDRINUSE.
 */
let shuttingDown = false
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  // eslint-disable-next-line no-console -- shutdown banner for the dev playground
  console.log(`\nReceived ${signal}, shutting down playground…`)
  await server.stop()
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    void shutdown(signal)
  })
}
