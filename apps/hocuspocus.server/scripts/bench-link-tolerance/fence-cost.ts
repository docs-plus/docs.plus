/**
 * Fence cost on loopback only, in place of an unfenced REST run (removed: unfenced, a shim
 * bypass reached the LAN). Not product code. Usage: bun fence-cost.ts [rounds] [out.json].
 * A toy server on 127.0.0.1:0; a client runs fenced and unfenced in ABAB order and times
 * pooled fetches, fresh-connection fetches and raw connects. Nothing dials off loopback.
 */
import { writeFileSync } from 'node:fs'

const profileFor = (port: number) =>
  '(version 1)(allow default)(deny network-outbound)' +
  `(allow network-outbound (remote ip "localhost:${port}"))` +
  '(deny network-outbound (remote unix-socket (path-literal "/private/var/run/mDNSResponder")))'

const N = { pooled: 2000, fresh: 300, connect: 300 }
const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mean = s.reduce((a, b) => a + b, 0) / s.length
  return {
    n: s.length,
    meanUs: Math.round(mean * 1000),
    p50Us: Math.round(q(s, 0.5) * 1000),
    p99Us: Math.round(q(s, 0.99) * 1000)
  }
}

const client = async (port: number) => {
  const url = `http://127.0.0.1:${port}/`
  const time = async (n: number, op: () => Promise<unknown>) => {
    const xs: number[] = []
    for (let i = 0; i < n; i++) {
      const t = performance.now()
      await op()
      xs.push(performance.now() - t)
    }
    return stats(xs)
  }
  const connect = () =>
    new Promise<void>((resolve, reject) => {
      Bun.connect({
        hostname: '127.0.0.1',
        port,
        socket: {
          data() {},
          open(s) {
            s.end()
            resolve()
          },
          connectError(_s, e) {
            reject(e)
          }
        }
      }).catch(reject)
    })
  const cpu0 = process.cpuUsage()
  const out = {
    pooled: await time(N.pooled, () => fetch(url).then((r) => r.text())),
    fresh: await time(N.fresh, () => fetch(url, { keepalive: false }).then((r) => r.text())),
    connect: await time(N.connect, connect),
    cpuMs: Math.round(
      (process.cpuUsage().user + process.cpuUsage().system - cpu0.user - cpu0.system) / 1000
    )
  }
  console.log(JSON.stringify(out))
}

const parent = async () => {
  const rounds = Number(process.argv[2] ?? 4)
  const outPath = process.argv[3]
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('x') })
  const port = server.port as number
  const runs: { arm: string; round: number; result: any }[] = []
  for (let r = 0; r < rounds; r++) {
    // ABAB, then BABA on odd rounds, so a drift over time does not favour one arm.
    const order = r % 2 === 0 ? ['fenced', 'unfenced'] : ['unfenced', 'fenced']
    for (const arm of order) {
      const cmd = [process.execPath, import.meta.path, 'client', String(port)]
      const p = Bun.spawn(
        arm === 'fenced' ? ['sandbox-exec', '-p', profileFor(port), ...cmd] : cmd,
        {
          stdout: 'pipe',
          stderr: 'inherit'
        }
      )
      const text = await new Response(p.stdout).text()
      await p.exited
      runs.push({ arm, round: r, result: JSON.parse(text.trim().split('\n').at(-1) ?? '{}') })
      await Bun.sleep(500)
    }
  }
  server.stop(true)
  const summary: Record<string, unknown> = {}
  for (const op of ['pooled', 'fresh', 'connect'] as const) {
    const diffs = [...Array(rounds).keys()].map((r) => {
      const f = runs.find((x) => x.round === r && x.arm === 'fenced')!.result[op].meanUs
      const u = runs.find((x) => x.round === r && x.arm === 'unfenced')!.result[op].meanUs
      return f - u
    })
    const m = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const sd = Math.sqrt(
      diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, diffs.length - 1)
    )
    summary[op] = {
      fencedMinusUnfencedMeanUs: Math.round(m),
      sdUs: Math.round(sd),
      perRound: diffs
    }
  }
  const out = {
    what: 'fence cost on loopback, client process fenced vs unfenced, toy Bun.serve',
    at: new Date().toISOString(),
    bun: Bun.revision,
    rounds,
    n: N,
    runs,
    summary
  }
  if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 1))
  console.log(JSON.stringify(summary, null, 1))
}

if (process.argv[2] === 'client') await client(Number(process.argv[3]))
else await parent()
