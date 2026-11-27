import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

export const REPO_ROOT = resolve(import.meta.dir, '..')

export const STATUS_ARIA = {
  saving: 'Syncing changes to server...',
  synced: 'Changes synced to server (visible to collaborators). Finishing save…',
  saved: 'All changes saved',
  offline: 'Offline',
  error: 'Error',
  reload: 'Reload'
} as const

export type ChipState = keyof typeof STATUS_ARIA | 'unknown'
export type ChipEvent = { ariaLabel: string; state: ChipState; perfNow: number; wallMs: number }
export type KeyEventRecord = { key: string; perfNow: number; wallMs: number }
export type CliConfig = ReturnType<typeof parseCli>
export type BenchRunResult = Awaited<ReturnType<typeof runSingleBench>>

export interface RecordedWsFrame {
  direction: 'sent' | 'received'
  cdpTs: number
  wallMs: number
  bytes: number
  decoded: {
    documentName: string
    messageType: number
    syncType?: number
    applied?: boolean
    statelessMsg?: string
  } | null
}

type CdpLike = {
  send(m: string, p?: Record<string, unknown>): Promise<unknown>
  on(e: string, l: (p: Record<string, unknown>) => void): void
}
export interface PageLike {
  goto(u: string, o?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  reload(o?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  close(): Promise<void>
  waitForSelector(s: string, o?: { timeout?: number }): Promise<unknown>
  click(s: string): Promise<void>
  evaluate<T, A = undefined>(fn: (arg: A) => T, arg?: A): Promise<T>
  keyboard: { type(t: string, o?: { delay?: number }): Promise<void> }
}
export type BrowserContextLike = {
  newPage(): Promise<PageLike>
  newCDPSession(p: PageLike): Promise<CdpLike>
  setOffline(o: boolean): Promise<void>
  close(): Promise<void>
}
export type BrowserLike = {
  version(): string
  newContext(o?: { viewport?: { width: number; height: number } }): Promise<BrowserContextLike>
  close(): Promise<void>
}
export type PadSession = {
  context: BrowserContextLike
  page: PageLike
  frames: RecordedWsFrame[]
  slug: string
}

export const EDITOR_EDITABLE_SELECTOR = '.docy_editor .tiptap.ProseMirror[contenteditable="true"]'

const parsePosInt = (raw: string, flag: string) => {
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid ${flag} value: ${raw}`)
  return n
}

export type BenchMode = 'bench' | 'checks' | 'all'

export function parseCli(defaultMode: BenchMode = 'bench') {
  const s = (d: string) => ({ type: 'string' as const, default: d })
  const b = () => ({ type: 'boolean' as const, default: false })
  const { values: v } = parseArgs({
    options: {
      'base-url': s('http://127.0.0.1:3001'),
      'rest-url': s('http://127.0.0.1:4000'),
      runs: s('5'),
      chars: s('100'),
      'interval-ms': s('125'),
      'cpu-throttle': s('4'),
      mode: s(defaultMode),
      out: { type: 'string' },
      'ws-restart-cmd': { type: 'string' },
      'skip-cleanup': b(),
      headed: b(),
      help: { ...b(), short: 'h' }
    },
    strict: true
  })
  if (v.help) {
    console.log(
      'Usage: bun scripts/bench-sync-chip.ts [--base-url <url>] [--rest-url <url>] [--runs <n>] [--chars <n>] [--interval-ms <n>] [--cpu-throttle <rate>] [--mode bench|checks|all] [--out <path>] [--ws-restart-cmd <cmd>] [--skip-cleanup] [--headed] [-h|--help]'
    )
    process.exit(0)
  }
  if (v.mode !== 'bench' && v.mode !== 'checks' && v.mode !== 'all')
    throw new Error(`Invalid --mode value: ${v.mode}`)
  const mode: BenchMode = v.mode
  return {
    baseUrl: v['base-url'].replace(/\/$/, ''),
    restUrl: v['rest-url'].replace(/\/$/, ''),
    runs: parsePosInt(v.runs, '--runs'),
    chars: parsePosInt(v.chars, '--chars'),
    intervalMs: parsePosInt(v['interval-ms'], '--interval-ms'),
    cpuThrottle: parsePosInt(v['cpu-throttle'], '--cpu-throttle'),
    mode,
    outPath: v.out ? resolve(process.cwd(), v.out) : null,
    wsRestartCmd: v['ws-restart-cmd'] ?? null,
    skipCleanup: v['skip-cleanup'],
    headless: !v.headed
  }
}

function readEnvValue(key: string): string | null {
  const envVal = process.env[key]
  if (envVal) return envVal
  const envPath = resolve(REPO_ROOT, '.env.local')
  const m = existsSync(envPath)
    ? readFileSync(envPath, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'))
    : null
  return m ? m[1].trim().replace(/^(['"])(.*)\1$/, '$2') : null
}

export async function pollUntil<T>(
  fn: () => Promise<T | null | false>,
  timeoutMs: number,
  intervalMs = 100
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const val = await fn()
    if (val !== null && val !== false) return val
    await Bun.sleep(intervalMs)
  }
  return null
}

export const readChipLabel = (page: PageLike) =>
  page.evaluate(
    () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
  )

export const readEditorText = (page: PageLike) =>
  page.evaluate(() => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? '')

type BenchWindow = Window & {
  __benchChipEvents?: ChipEvent[]
  __benchKeyEvents?: KeyEventRecord[]
  __benchObserver?: MutationObserver
  __benchKeyHandlerAttached?: boolean
}

export async function installPageObservers(page: PageLike): Promise<void> {
  await page.evaluate((statusAria) => {
    const w = window as BenchWindow
    const labelMap = Object.fromEntries(
      Object.entries(statusAria).map(([k, v]) => [v, k])
    ) as Record<string, ChipState>
    const header = document.querySelector('header')
    if (!header) throw new Error('Header element not found')
    const getLabel = () => header.querySelector('[role="status"]')?.getAttribute('aria-label') ?? ''
    w.__benchChipEvents = []
    w.__benchKeyEvents = []
    w.__benchObserver?.disconnect()
    let lastLabel = getLabel()
    w.__benchObserver = new MutationObserver(() => {
      const label = getLabel()
      if (!label || label === lastLabel) return
      lastLabel = label
      const perfNow = performance.now()
      w.__benchChipEvents?.push({
        ariaLabel: label,
        state: labelMap[label] ?? 'unknown',
        perfNow,
        wallMs: performance.timeOrigin + perfNow
      })
    })
    w.__benchObserver.observe(header, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-label']
    })
    const editorEl = document.querySelector<HTMLElement>('.docy_editor .tiptap.ProseMirror')
    if (editorEl && !w.__benchKeyHandlerAttached) {
      w.__benchKeyHandlerAttached = true
      editorEl.addEventListener(
        'keydown',
        (e) => {
          const perfNow = performance.now()
          w.__benchKeyEvents?.push({
            key: e.key,
            perfNow,
            wallMs: performance.timeOrigin + perfNow
          })
        },
        true
      )
    }
  }, STATUS_ARIA)
}

export const readPageEvents = (
  page: PageLike
): Promise<{ chipEvents: ChipEvent[]; keyEvents: KeyEventRecord[] }> =>
  page.evaluate(() => {
    const w = window as BenchWindow
    return { chipEvents: w.__benchChipEvents ?? [], keyEvents: w.__benchKeyEvents ?? [] }
  })

export async function withPadSession<T>(
  browser: BrowserLike,
  baseUrl: string,
  slug: string,
  cpuThrottle: number,
  decodeFrame: (base64Payload: string) => RecordedWsFrame['decoded'],
  fn: (session: PadSession) => Promise<T>
): Promise<T> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle })
    await cdp.send('Network.enable')
    let cdpOffsetMs: number | null = null
    const frames: RecordedWsFrame[] = []
    cdp.on('Network.requestWillBeSent', (p) => {
      if (cdpOffsetMs === null && typeof p.timestamp === 'number' && typeof p.wallTime === 'number')
        cdpOffsetMs = (p.wallTime - p.timestamp) * 1000
    })
    const pushFrame = (direction: 'sent' | 'received', p: Record<string, unknown>) => {
      const cdpTs = typeof p.timestamp === 'number' ? p.timestamp : 0
      const resp = p.response as { opcode?: number; payloadData?: string } | undefined
      if (!resp || resp.opcode !== 2 || typeof resp.payloadData !== 'string') return
      const wallMs = cdpOffsetMs === null ? Date.now() : cdpTs * 1000 + cdpOffsetMs
      frames.push({
        direction,
        cdpTs,
        wallMs,
        bytes: Buffer.byteLength(resp.payloadData, 'base64'),
        decoded: decodeFrame(resp.payloadData)
      })
    }
    cdp.on('Network.webSocketFrameSent', (p) => pushFrame('sent', p))
    cdp.on('Network.webSocketFrameReceived', (p) => pushFrame('received', p))

    await page.goto(`${baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(EDITOR_EDITABLE_SELECTOR, { timeout: 35_000 })
    await page.click(EDITOR_EDITABLE_SELECTOR)
    await page.waitForSelector(`header [role="status"][aria-label="${STATUS_ARIA.saved}"]`, {
      timeout: 35_000
    })
    await pollUntil(
      async () => {
        const n = frames.length
        await Bun.sleep(1300)
        return frames.length === n && (await readChipLabel(page)) === STATUS_ARIA.saved
      },
      35_000,
      0
    )
    return await fn({ context, page, frames, slug })
  } finally {
    await context.close()
  }
}

export async function fetchDocumentMetaBySlug(
  restUrl: string,
  slug: string
): Promise<{ documentId: string }> {
  const res = await fetch(`${restUrl}/api/documents/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`GET /api/documents/${slug} failed with ${res.status}`)
  const body = (await res.json()) as { data?: { documentId?: string } }
  if (!body.data?.documentId) throw new Error(`Missing documentId for slug ${slug}`)
  return { documentId: body.data.documentId }
}

export function median(nums: number[]): number {
  if (nums.length === 0) return Number.NaN
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const isSettledState = (state: ChipState) => state === 'synced' || state === 'saved'
const deltaOrNull = (val: number | null, ref: number) =>
  val !== null ? Math.round(val - ref) : null

async function runSingleBench(
  browser: BrowserLike,
  config: CliConfig,
  runIndex: number,
  slugPrefix: string
) {
  const c = await import('./check-sync-chip')
  const slug = `${slugPrefix}-r${runIndex}-${Date.now()}`
  return withPadSession(
    browser,
    config.baseUrl,
    slug,
    config.cpuThrottle,
    c.decodeHocuspocusFrame,
    async ({ page, frames }) => {
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)
      const baselineIdx = frames.length
      await installPageObservers(page)

      const typingStartWallMs = Date.now()
      const startPerf = performance.now()
      for (let i = 0; i < config.chars; i += 1) {
        const waitMs = startPerf + i * config.intervalMs - performance.now()
        if (waitMs > 1) await Bun.sleep(waitMs)
        await page.keyboard.type('abcdefghij'[i % 10], { delay: 0 })
      }
      const typingEndWallMs = Date.now()
      const { keyEvents: initialKeys } = await readPageEvents(page)
      const settleKeystrokeWallMs = initialKeys.at(-1)?.wallMs ?? typingEndWallMs

      const settled = await c.waitForPayloadAcks(
        frames,
        baselineIdx,
        25_000,
        documentId,
        async () =>
          (await readPageEvents(page)).chipEvents.some(
            (e) => e.wallMs >= settleKeystrokeWallMs && isSettledState(e.state)
          )
      )
      if (!settled)
        throw new Error(`Run ${runIndex} (${slug}) timed out waiting for SyncStatus & chip settle`)

      const { chipEvents, keyEvents } = await readPageEvents(page)
      const post = frames.slice(baselineIdx)
      const syncUpdates = post.filter((f) => c.isSyncUpdateFrame(f, documentId))
      const syncAcks = post.filter((f) => c.isSyncAckFrame(f, documentId))
      const typingStartBrowserWallMs = keyEvents[0]?.wallMs ?? typingStartWallMs
      const lastKeystrokeWallMs = keyEvents.at(-1)?.wallMs ?? settleKeystrokeWallMs
      const finalAckWallMs = syncAcks.at(-1)?.wallMs ?? null
      const settledAfter = chipEvents.filter(
        (e) => e.wallMs >= typingStartBrowserWallMs && isSettledState(e.state)
      )
      const syncedEventsAfterStart = settledAfter
        .filter((e) => e.state === 'synced')
        .map((e) => ({
          wallMs: e.wallMs,
          fromLastKeystrokeMs: Math.round(e.wallMs - lastKeystrokeWallMs)
        }))
      const finalSyncedWallMs = syncedEventsAfterStart.at(-1)?.wallMs ?? null

      return {
        run: runIndex,
        slug,
        documentId,
        typingStartWallMs: typingStartBrowserWallMs,
        lastKeystrokeWallMs,
        typingUpdateFrames: syncUpdates.length,
        typingSyncStatusTrueFrames: syncAcks.length,
        statelessSavedFrames: post.filter((f) => c.isStatelessSavedFrame(f, documentId)).length,
        totalWsFramesSent: post.filter((f) => f.direction === 'sent').length,
        totalWsFramesReceived: post.filter((f) => f.direction === 'received').length,
        totalWsFrames: post.length,
        firstSyncUpdateSentWallMs: syncUpdates[0]?.wallMs ?? null,
        lastSyncUpdateSentWallMs: syncUpdates.at(-1)?.wallMs ?? null,
        finalSyncStatusWallMs: finalAckWallMs,
        lastKeystrokeToFinalSyncStatusMs: deltaOrNull(finalAckWallMs, lastKeystrokeWallMs),
        syncedEventsAfterStart,
        finalSyncedWallMs,
        finalKeystrokeToSyncedMs: deltaOrNull(finalSyncedWallMs, lastKeystrokeWallMs),
        metric1PrematureSynced:
          finalAckWallMs !== null && settledAfter.some((e) => e.wallMs < finalAckWallMs),
        metric2DeltaMs:
          finalSyncedWallMs !== null && finalAckWallMs !== null
            ? Math.round(finalSyncedWallMs - finalAckWallMs)
            : null,
        chipEvents
      }
    }
  )
}

export async function runMain(defaultMode: CliConfig['mode'] = 'bench'): Promise<void> {
  const config = parseCli(defaultMode)
  const { cleanupBenchPads, runContentSafetyChecks } = await import('./check-sync-chip')
  const req = createRequire(resolve(REPO_ROOT, 'packages/playground/package.json'))
  const playwright = req('playwright') as {
    chromium: { launch(o?: { headless?: boolean }): Promise<BrowserLike>; executablePath(): string }
  }
  const slugPrefix = `bench-sync-${Date.now().toString(36)}`
  const serviceRoleKey = readEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  if ((config.mode === 'checks' || config.mode === 'all') && !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in env or .env.local for REST pad reads')
  }

  const browser = await playwright.chromium.launch({ headless: config.headless })
  const browserVersion = browser.version()
  const executablePath = playwright.chromium.executablePath()
  console.log(
    `[bench-sync-chip] Chromium ${browserVersion} (${executablePath}), mode=${config.mode}, runs=${config.runs}, chars=${config.chars}, interval=${config.intervalMs}ms, cpuThrottle=${config.cpuThrottle}x`
  )

  const benchRuns: BenchRunResult[] = []
  let checks: Awaited<ReturnType<typeof runContentSafetyChecks>> = []
  try {
    if (config.mode === 'bench' || config.mode === 'all') {
      for (let i = 1; i <= config.runs; i += 1) {
        const r = await runSingleBench(browser, config, i, slugPrefix)
        benchRuns.push(r)
        console.log(
          `[run ${i}/${config.runs}] slug=${r.slug} premature=${r.metric1PrematureSynced} syncedMs=${r.finalKeystrokeToSyncedMs} syncStatusMs=${r.lastKeystrokeToFinalSyncStatusMs} deltaMs=${r.metric2DeltaMs} updates=${r.typingUpdateFrames} acks=${r.typingSyncStatusTrueFrames} totalWs=${r.totalWsFrames}`
        )
      }
    }
    if (config.mode === 'checks' || config.mode === 'all') {
      checks = await runContentSafetyChecks(
        browser,
        config,
        serviceRoleKey ?? '',
        slugPrefix,
        benchRuns
      )
      for (const c of checks) console.log(`[check ${c.check}] ${c.status}: ${c.name} — ${c.detail}`)
    }
  } finally {
    await browser.close()
    if (!config.skipCleanup) {
      try {
        console.log(
          `[bench-sync-chip] cleaned ${cleanupBenchPads(slugPrefix)} Postgres scratch rows (${slugPrefix}*)`
        )
      } catch (err) {
        console.warn(
          `[bench-sync-chip] skipping Postgres cleanup (${err instanceof Error ? err.message : String(err)})`
        )
      }
    }
  }

  const nonNull = (xs: Array<number | null>) => xs.filter((v): v is number => v !== null)
  const med = (xs: number[]) => (xs.length ? median(xs) : null)
  const rng = (xs: number[]): [number, number] | null =>
    xs.length ? [Math.min(...xs), Math.max(...xs)] : null
  const m2 = nonNull(benchRuns.map((r) => r.metric2DeltaMs))
  const rtt = nonNull(benchRuns.map((r) => r.lastKeystrokeToFinalSyncStatusMs))
  const syn = nonNull(benchRuns.map((r) => r.finalKeystrokeToSyncedMs))
  const upd = benchRuns.map((r) => r.typingUpdateFrames)
  const ws = benchRuns.map((r) => r.totalWsFrames)
  const aggregates = benchRuns.length
    ? {
        metric1PrematureCount: benchRuns.filter((r) => r.metric1PrematureSynced).length,
        metric1TotalRuns: benchRuns.length,
        metric2MedianMs: med(m2),
        metric2RangeMs: rng(m2),
        keystrokeToSyncedMedianMs: med(syn),
        keystrokeToSyncedRangeMs: rng(syn),
        keystrokeToSyncStatusMedianMs: med(rtt),
        keystrokeToSyncStatusRangeMs: rng(rtt),
        updateFramesMedian: med(upd),
        updateFramesRange: rng(upd),
        totalWsFramesMedian: med(ws),
        totalWsFramesRange: rng(ws)
      }
    : null

  if (aggregates) {
    const fmt = (r: [number, number] | null) => (r ? `${r[0]}..${r[1]}ms` : 'n/a')
    console.log(
      `[summary] Metric(1)=${aggregates.metric1PrematureCount}/${aggregates.metric1TotalRuns} | Metric(2) median=${aggregates.metric2MedianMs ?? 'n/a'}ms (${fmt(aggregates.metric2RangeMs)}) | WS RTT median=${aggregates.keystrokeToSyncStatusMedianMs ?? 'n/a'}ms (${fmt(aggregates.keystrokeToSyncStatusRangeMs)})`
    )
  }
  if (config.outPath) {
    const { runs, chars, intervalMs, cpuThrottle, mode } = config
    const summary = {
      browserVersion,
      executablePath,
      aggregates,
      runs: benchRuns,
      checks,
      config: { runs, chars, intervalMs, cpuThrottle, mode }
    }
    mkdirSync(dirname(config.outPath), { recursive: true })
    writeFileSync(config.outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(`[bench-sync-chip] wrote JSON report to ${config.outPath}`)
  }
}

if (import.meta.main) await runMain('bench')
