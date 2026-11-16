/**
 * #602 probe, not a test: does `ws` on Bun send large queued frames more than once?
 * Run: bun apps/hocuspocus.server/scripts/probe-ws-frame-repeat.ts --sizes 65536,1048576,4194304 --frames 8 --runs 5 --deflate <off|on> [--ws hocuspocus|npm] [--wait 20000] [--settle 1000]
 * One NDJSON row per run: size, arm, run, sentBytes, wireBytes, ratio, framesSent, framesReceived, repeatedFrames.
 * wireBytes is server-to-client bytes after the 101 reply, counted at a TCP relay the client dials.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage } from 'node:http'
import { createRequire } from 'node:module'
import net, { type AddressInfo } from 'node:net'
import { cpus, machine } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

const { values: opt } = parseArgs({
  options: {
    sizes: { type: 'string', default: '65536,1048576,4194304' },
    frames: { type: 'string', default: '8' },
    runs: { type: 'string', default: '5' },
    deflate: { type: 'string', default: 'off' },
    ws: { type: 'string', default: 'hocuspocus' },
    wait: { type: 'string', default: '20000' },
    settle: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '602' }
  }
})
const sizes = opt.sizes.split(',').map(Number)
const frames = Number(opt.frames)
const runs = Number(opt.runs)
const deflate = opt.deflate === 'on'
const arm = deflate ? 'B' : 'A'
const waitMs = Number(opt.wait)
const settleMs = Number(opt.settle)
if (!['on', 'off'].includes(opt.deflate) || !['hocuspocus', 'npm'].includes(opt.ws)) {
  console.error('usage: --deflate <off|on> --ws <hocuspocus|npm>')
  process.exit(2)
}

// Resolve `ws` the way @hocuspocus/server does. Under Bun that is Bun's built-in module.
const hocusPath = createRequire(join(import.meta.dir, '..') + '/').resolve('@hocuspocus/server')
const hocusReq = createRequire(hocusPath)
const wsResolved = hocusReq.resolve('ws')
const wsNpmDir = dirname(hocusReq.resolve('ws/package.json'))
const wsModule = opt.ws === 'npm' ? hocusReq(join(wsNpmDir, 'index.js')) : hocusReq(wsResolved)

// mulberry32: a fixed seed gives the same random, incompressible bytes on every host.
function randomBytes(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n)
  let s = seed >>> 0
  for (let i = 0; i < n; i += 4) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    const v = (t ^ (t >>> 14)) >>> 0
    for (let k = 0; k < 4 && i + k < n; k++) out[i + k] = (v >>> (8 * k)) & 0xff
  }
  return out
}

function makeFrames(size: number): { payloads: Uint8Array[]; hashes: bigint[] } {
  const payloads: Uint8Array[] = []
  for (let i = 0; i < frames; i++) {
    const p = randomBytes(size, Number(opt.seed) * 1000 + i)
    new DataView(p.buffer).setUint32(0, i, true)
    payloads.push(p)
  }
  return { payloads, hashes: payloads.map((p) => BigInt(Bun.hash(p))) }
}

type Relay = {
  port: number
  wireBytes: () => number
  extensions: () => string | null
  close: () => void
}

// Counts only the server-to-client direction, so the client's own frames never inflate the ratio.
function startRelay(target: number): Promise<Relay> {
  let wire = 0
  let ext: string | null = null
  const server = net.createServer((client) => {
    const upstream = net.connect(target, '127.0.0.1')
    let head = Buffer.alloc(0)
    let upgraded = false
    upstream.on('data', (chunk: Buffer) => {
      if (upgraded) wire += chunk.length
      else {
        head = Buffer.concat([head, chunk])
        const end = head.indexOf('\r\n\r\n')
        if (end >= 0) {
          upgraded = true
          ext =
            /sec-websocket-extensions:\s*([^\r]*)/i.exec(head.subarray(0, end).toString())?.[1] ??
            null
          wire += head.length - end - 4
        }
      }
      if (!client.write(chunk)) upstream.pause()
    })
    client.on('drain', () => upstream.resume())
    client.on('data', (chunk: Buffer) => {
      if (!upstream.write(chunk)) client.pause()
    })
    upstream.on('drain', () => client.resume())
    const done = () => {
      client.destroy()
      upstream.destroy()
    }
    client.on('close', done).on('error', done)
    upstream.on('close', done).on('error', done)
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: (server.address() as AddressInfo).port,
        wireBytes: () => wire,
        extensions: () => ext,
        close: () => server.close()
      })
    )
  )
}

type WsSocket = {
  on(event: 'message', cb: () => void): void
  send(data: Uint8Array, cb: (err?: Error) => void): void
}

async function startWsServer(payloads: Uint8Array[]) {
  const http = createServer()
  const wss = new wsModule.WebSocketServer({ noServer: true, perMessageDeflate: deflate })
  http.on('upgrade', (req: IncomingMessage, sock: net.Socket, head: Buffer) =>
    wss.handleUpgrade(req, sock, head, (ws: WsSocket) => {
      // Queue every frame in one tick on one socket, as a large history.watch reply does.
      ws.on('message', () => {
        for (const p of payloads) ws.send(p, () => {})
      })
    })
  )
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()))
  return {
    port: (http.address() as AddressInfo).port,
    close: () => {
      wss.close()
      http.close()
      http.closeAllConnections?.()
    }
  }
}

async function runOnce(size: number, run: number, set: ReturnType<typeof makeFrames>) {
  const srv = await startWsServer(set.payloads)
  const relay = await startRelay(srv.port)
  const seen = new Map<number, number>()
  let received = 0
  let corrupt = 0
  let error: string | null = null
  const started = performance.now()
  await new Promise<void>((resolve) => {
    const c = new WebSocket(`ws://127.0.0.1:${relay.port}`)
    c.binaryType = 'arraybuffer'
    const hard = setTimeout(finish, waitMs)
    let settle: Timer | undefined
    function finish() {
      clearTimeout(hard)
      clearTimeout(settle)
      c.close()
      resolve()
    }
    c.onopen = () => c.send('go')
    c.onerror = () => {
      error = 'client error'
      finish()
    }
    c.onclose = (e) => {
      if (seen.size < frames) error ??= `closed ${e.code} before all frames`
      finish()
    }
    c.onmessage = (e) => {
      const buf = new Uint8Array(e.data as ArrayBuffer)
      received++
      const idx = buf.byteLength >= 4 ? new DataView(buf.buffer).getUint32(0, true) : -1
      if (idx < 0 || idx >= frames || BigInt(Bun.hash(buf)) !== set.hashes[idx]) corrupt++
      else seen.set(idx, (seen.get(idx) ?? 0) + 1)
      // Keep listening a moment after the last unique frame, so a late repeat still counts.
      if (seen.size === frames && !settle) settle = setTimeout(finish, settleMs)
    }
  })
  const ms = Math.round(performance.now() - started)
  const wireBytes = relay.wireBytes()
  const extensions = relay.extensions()
  relay.close()
  srv.close()
  const sentBytes = frames * size
  const repeated = [...seen.values()].reduce((a, n) => a + n - 1, 0)
  return {
    size,
    arm,
    deflate: opt.deflate,
    run,
    sentBytes,
    wireBytes,
    ratio: +(wireBytes / sentBytes).toFixed(3),
    framesSent: frames,
    framesReceived: received,
    repeatedFrames: repeated,
    missingFrames: frames - seen.size,
    corruptFrames: corrupt,
    extensions,
    ms,
    error
  }
}

// Read after the runs, so loading Hocuspocus cannot delay the first burst.
async function facts() {
  const { Server } = await import(hocusPath)
  const cpu = existsSync('/proc/cpuinfo') ? readFileSync('/proc/cpuinfo', 'utf8') : ''
  const flags = /^flags\s*:(.*)$/m.exec(cpu)?.[1]
  return {
    probeSha256: createHash('sha256')
      .update(readFileSync(import.meta.path))
      .digest('hex'),
    bun: Bun.version,
    bunRevision: Bun.revision,
    platform: process.platform,
    machine: machine(),
    cpuModel: cpus()[0]?.model ?? null,
    avx2: flags === undefined ? null : /\bavx2\b/.test(flags),
    wsSource: opt.ws,
    wsResolved,
    wsIsBunBuiltin: opt.ws === 'hocuspocus' && !wsResolved.startsWith('/'),
    hocusUsesSameWs:
      new Server({ quiet: true }).webSocketServer?.constructor ===
      hocusReq(wsResolved).WebSocketServer,
    wsNpmVersion: JSON.parse(readFileSync(join(wsNpmDir, 'package.json'), 'utf8')).version,
    frames,
    runs,
    seed: Number(opt.seed)
  }
}

const rows: Awaited<ReturnType<typeof runOnce>>[] = []
for (const size of sizes) {
  const set = makeFrames(size)
  for (let run = 1; run <= runs; run++) {
    const row = await runOnce(size, run, set)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
}
const f = await facts()
console.log(JSON.stringify({ facts: f }))

// Pass rule from #602. Arm B's byte ratio is context only, since deflate changes wire bytes.
const negotiated = rows.every(
  (r) => (r.extensions ?? '').includes('permessage-deflate') === deflate
)
const fails = rows.filter(
  (r) =>
    r.error !== null ||
    r.repeatedFrames > 0 ||
    r.missingFrames > 0 ||
    r.corruptFrames > 0 ||
    r.framesReceived !== r.framesSent ||
    (!deflate && r.ratio !== 1)
)
for (const size of sizes) {
  const rs = rows
    .filter((r) => r.size === size)
    .map((r) => r.ratio)
    .sort((a, b) => a - b)
  const mid =
    rs.length % 2 ? rs[(rs.length - 1) / 2] : (rs[rs.length / 2 - 1] + rs[rs.length / 2]) / 2
  const rep = rows.filter((r) => r.size === size).reduce((a, r) => a + r.repeatedFrames, 0)
  console.error(
    `arm ${arm} size ${size}: n ${rs.length}, ratio median ${mid} range ${rs[0]}-${rs.at(-1)}, repeats ${rep}`
  )
}
const verdict = fails.length === 0 && negotiated ? 'pass' : 'fail'
console.error(
  `arm ${arm} (deflate ${opt.deflate}, ws ${opt.ws}) on Bun ${f.bun} ${f.machine}: ${verdict}` +
    (negotiated ? '' : ' (deflate negotiation did not match the arm)') +
    `, ${fails.length} failing run(s)`
)
process.exit(verdict === 'pass' ? 0 : 1)
