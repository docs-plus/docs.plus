/**
 * The bench's speed workloads in a real browser. Builds the variants, serves one cross-origin
 * isolated page on http://127.0.0.1:5199, waits for its result, then prints the speed table.
 * Usage: NODE_ENV=production bun scripts/bench/browser.ts [--ref main] [--runs 9] [--save file.json]
 */
/* eslint-disable no-console -- a CLI that prints its report */
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { buildVariants, distSha256 } from './build'
import { loadEsbuild, OUT, PKG, VARIANTS } from './paths'

const { values } = parseArgs({
  options: {
    ref: { type: 'string', default: 'main' },
    runs: { type: 'string', default: '9' },
    port: { type: 'string', default: '5199' },
    save: { type: 'string' }
  }
})
const date = new Date().toISOString()
await buildVariants(values.ref!)

// The page yields with MessageChannel: an occluded window throttles setTimeout, not this.
// The lag probe runs after an idle second: right after a workload, the editor's own queued work
// (about 120 ms after a big paste) would look like throttling. Idle lag over 50 ms means background.
// Before each timed round, settle: two yields, then an idle callback, so the last round's work is done.
const entry = `
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { WORKLOADS } from ${JSON.stringify(join(import.meta.dir, 'workloads.ts'))}
${VARIANTS.map((v, i) => `import * as V${i} from ${JSON.stringify(join(OUT, v, 'dist', 'rt.js'))}`).join('\n')}
const mods = { ${VARIANTS.map((v, i) => `${v}: V${i}`).join(', ')} }
const names = ${JSON.stringify(VARIANTS)}, RUNS = ${Number(values.runs)}
const stage = document.getElementById('stage'), status = document.getElementById('status')
const env = { Editor, StarterKit, win: window, stage }
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const yieldOnce = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0) })
const timerLag = () => new Promise((r) => { const t = performance.now(); setTimeout(() => r(performance.now() - t), 0) })
const idleLag = () => new Promise((r) => setTimeout(r, 1000)).then(timerLag)
let settleTimeouts = 0
async function settle() {
  await yieldOnce(); await yieldOnce()
  if (typeof requestIdleCallback !== 'function') return
  const deadline = await new Promise((r) => requestIdleCallback(r, { timeout: 200 }))
  if (deadline.didTimeout) settleTimeouts++
}
function timerStep() {
  let min = Infinity
  for (let i = 0; i < 20; i++) { const a = performance.now(); let b; while ((b = performance.now()) === a); min = Math.min(min, b - a) }
  return +min.toFixed(4)
}
async function main() {
  const result = { userAgent: navigator.userAgent, runs: RUNS, crossOriginIsolated, timerStepMs: timerStep(), speed: {} }
  let hidden = document.visibilityState !== 'visible', lag = await idleLag()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') hidden = true })
  for (const [name, w] of Object.entries(WORKLOADS)) {
    status.textContent = 'running ' + name
    for (const v of names) { w.run(env, mods[v]).editor.destroy(); stage.replaceChildren() }
    const times = {}, docs = {}
    for (let r = 0; r < RUNS; r++) for (let j = 0; j < names.length; j++) {
      const v = names[(j + r) % names.length]
      await settle()
      const { editor, ms } = w.run(env, mods[v])
      ;(times[v] ??= []).push(ms); docs[v] = JSON.stringify(editor.getJSON())
      editor.destroy(); stage.replaceChildren()
    }
    lag = Math.max(lag, await idleLag())
    result.speed[name] = { unit: w.unit }
    for (const v of names) result.speed[name][v] = { median: +median(times[v]).toFixed(3), sameDocAsBase: docs[v] === docs.base, samples: times[v].map((t) => +t.toFixed(3)) }
  }
  result.settleTimeouts = settleTimeouts
  result.maxTimerLagMs = +lag.toFixed(1)
  result.background = hidden || lag > 50
  status.textContent = 'done'
  await fetch('/result', { method: 'POST', body: JSON.stringify(result) })
}
main().catch((err) => { status.textContent = 'error: ' + err.message })
`
const esbuild = await loadEsbuild()
const built = await esbuild.build({
  stdin: { contents: entry, resolveDir: PKG, loader: 'ts' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: true,
  write: false,
  logLevel: 'error',
  nodePaths: [join(PKG, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' }
})
const script = built.outputFiles[0].text.split('</script').join('<\\/script')
// #stage is off-screen but laid out, like the editor on a real pad.
const page = `<!doctype html><meta charset="utf-8"><title>Hyperlink bench</title>
<style>body{font:14px system-ui;margin:16px}#stage{position:absolute;left:-10000px;top:0;width:800px}</style>
<h1>Hyperlink bench</h1><p>Keep this window in front until it says done.</p><p id="status">starting</p><div id="stage"></div>
<script>${script}</script>`

const url = `http://127.0.0.1:${values.port}`
let finish: (body: any) => void
const done = new Promise<any>((r) => (finish = r))
const server = Bun.serve({
  port: Number(values.port),
  hostname: '127.0.0.1',
  async fetch(req) {
    if (req.method === 'POST' && new URL(req.url).pathname === '/result') {
      finish(await req.json())
      return new Response('saved')
    }
    // COOP and COEP make the page cross-origin isolated, so performance.now() is not coarsened.
    return new Response(page, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp'
      }
    })
  }
})
console.log(`Open ${url} in a browser window and keep it in front.`)
const result = {
  ref: values.ref,
  date,
  distSha256: distSha256(),
  ...(await done)
}
server.stop()
if (values.save) await Bun.write(values.save, JSON.stringify(result, null, 1))

const pct = (a: number, b: number) => `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(0)}%`
console.log(
  `\n${result.userAgent}, ${result.runs} rounds. Max idle timer lag ${result.maxTimerLagMs} ms.`
)
console.log(
  `Cross-origin isolated: ${result.crossOriginIsolated}, timer step ${result.timerStepMs} ms, settle timeouts ${result.settleTimeouts}.`
)
console.log(
  result.background
    ? 'Background page: compare ratios only, do not quote the times.\n'
    : 'Foreground page.\n'
)
console.log('| Speed (browser) | base | head | Change |\n| --- | --- | --- | --- |')
for (const [name, s] of Object.entries<any>(result.speed))
  console.log(
    `| ${name} (${s.unit}) | ${s.base.median} | ${s.head.median} | ${pct(s.base.median, s.head.median)} · control ${pct(s.base.median, s.control.median)}${s.head.sameDocAsBase ? '' : ' · output differs'} |`
  )
