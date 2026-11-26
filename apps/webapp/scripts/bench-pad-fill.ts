/**
 * Pad cold-open fill and collab WebSocket byte benchmark (GitHub issue #738, Step 5).
 *
 * Replaces `fillcheck.ts` (sha256: `42c003a702ebddd9235992c44350fe7f5aebd83cbe0ba5e04f96412e3575a667`)
 * as the repo fill benchmark. Reused by #733 and #739.
 *
 * Playwright condition:
 * - Fresh browser context per run (no HTTP cache, no service worker, no IndexedDB)
 * - Viewport: 1440 x 900
 * - Headless Chrome (`channel: 'chrome'`, `headless: true`, no CPU or network throttling)
 * - Read-only: opens the pad and waits for it to fill; never clicks or types into the pad
 *
 * Wait rule (preserved verbatim from `fillcheck.ts`):
 * - Start the clock right before `page.goto(url, { waitUntil: 'domcontentloaded' })`
 * - Wait for `document.querySelectorAll('.ProseMirror [data-toc-id]').length > 20`
 * - Default timeout is 45,000 ms; a timeout counts as a failed run (`filled_ms: -1`, `timed_out: true`)
 *   and is never dropped from stdout or the summary
 *
 * Usage:
 *   bun apps/webapp/scripts/bench-pad-fill.ts
 *   bun apps/webapp/scripts/bench-pad-fill.ts --url https://docs.plus/demo --runs 10 --out /tmp/pad-fill.json
 *   bun apps/webapp/scripts/bench-pad-fill.ts --runs 1 --room-loaded cold --timeout-ms 45000
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

type RoomLoadedState = 'unknown' | 'cold' | 'warm'

interface CliConfig {
  url: string
  runs: number
  timeoutMs: number
  roomLoaded: RoomLoadedState
  outPath: string | null
}

interface CdpSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: string, listener: (payload: Record<string, unknown>) => void): void
}

interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  waitForFunction(
    fn: () => unknown,
    arg?: unknown,
    options?: { timeout?: number }
  ): Promise<unknown>
  evaluate<T>(fn: () => T): Promise<T>
}

interface BrowserContextLike {
  newPage(): Promise<PageLike>
  newCDPSession(page: PageLike): Promise<CdpSessionLike>
  close(): Promise<void>
}

interface BrowserLike {
  version(): string
  newContext(options?: {
    viewport?: { width: number; height: number }
    serviceWorkers?: 'allow' | 'block'
  }): Promise<BrowserContextLike>
  close(): Promise<void>
}

interface PlaywrightModule {
  chromium: {
    launch(options?: { channel?: string; headless?: boolean }): Promise<BrowserLike>
  }
}

interface SocketTracker {
  url: string
  isCollab: boolean
  bytesReceived: number
  framesReceived: number
}

interface RunResult {
  kind: 'run'
  run: number
  passed: boolean
  timed_out: boolean
  filled_ms: number
  headings: number
  dom: number
  ws_bytes_received: number
  ws_frames_received: number
  collab_ws_url: string | null
  room_loaded: RoomLoadedState
  error?: string
}

interface NumericStats {
  median: number | null
  min: number | null
  max: number | null
}

interface EnvHeader {
  kind: 'env'
  script_sha256: string
  url: string
  runs: number
  timeout_ms: number
  browser_version: string
  playwright_version: string
  channel: string
  viewport: { width: number; height: number }
  at: string
}

interface SummaryOutput {
  kind: 'summary'
  script_sha256: string
  url: string
  runs: number
  passed: number
  failed: number
  browser_version: string
  playwright_version: string
  filled_ms: NumericStats
  ws_bytes_received: NumericStats
  ws_frames_received: NumericStats
}

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '../../..')
const DEFAULT_URL = 'https://docs.plus/demo'
const DEFAULT_RUNS = 10
const DEFAULT_TIMEOUT_MS = 45_000
const VIEWPORT = { width: 1440, height: 900 } as const
const CHROME_CHANNEL = 'chrome'

function printHelp(): void {
  console.log(`Usage: bun apps/webapp/scripts/bench-pad-fill.ts [options]

Options:
  --url <url>                       Target pad URL (default: ${DEFAULT_URL})
  --runs <n>                        Number of cold-open runs (default: ${DEFAULT_RUNS})
  --timeout-ms <ms>                 Fill wait timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --room-loaded <unknown|cold|warm> Initial room state on run 1 (default: unknown)
  --out <jsonPath>                  Write full JSON report to this path
  -h, --help                        Show this help`)
}

function parsePositiveInt(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== raw.trim()) {
    throw new Error(`Invalid ${flag} value: ${raw}`)
  }
  return parsed
}

function parseRoomLoaded(raw: string): RoomLoadedState {
  if (raw === 'unknown' || raw === 'cold' || raw === 'warm') return raw
  throw new Error(`Invalid --room-loaded value: ${raw} (expected unknown, cold, or warm)`)
}

function parseCli(): CliConfig {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: DEFAULT_URL },
      runs: { type: 'string', default: String(DEFAULT_RUNS) },
      'timeout-ms': { type: 'string', default: String(DEFAULT_TIMEOUT_MS) },
      'room-loaded': { type: 'string', default: 'unknown' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false }
    },
    strict: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  return {
    url: values.url,
    runs: parsePositiveInt(values.runs, '--runs'),
    timeoutMs: parsePositiveInt(values['timeout-ms'], '--timeout-ms'),
    roomLoaded: parseRoomLoaded(values['room-loaded']),
    outPath: values.out ? resolve(process.cwd(), values.out) : null
  }
}

function loadPlaywright(): { playwright: PlaywrightModule; playwrightVersion: string } {
  // Reuse the workspace Playwright package instead of hardcoding a cache path.
  const requireFromPlayground = createRequire(
    resolve(REPO_ROOT, 'packages/playground/package.json')
  )
  const playwright = requireFromPlayground('playwright') as PlaywrightModule
  const pkg = requireFromPlayground('playwright/package.json') as { version?: string }
  return {
    playwright,
    playwrightVersion: pkg.version ?? 'unknown'
  }
}

function computeFileSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function stripQuery(rawUrl: string): string {
  const qIndex = rawUrl.indexOf('?')
  return qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex)
}

function isCollabWebSocketUrl(rawUrl: string): boolean {
  try {
    const { pathname } = new URL(rawUrl)
    // Exclude Supabase Realtime and Next.js dev HMR sockets so only the collab socket is counted.
    if (/\/realtime\/v\d+\/websocket\b/i.test(pathname)) return false
    if (pathname.includes('/_next/webpack-hmr')) return false
    return true
  } catch {
    return true
  }
}

function frameByteLength(opcode: number, payloadData: string): number {
  if (opcode === 2) return Buffer.from(payloadData, 'base64').byteLength
  if (opcode === 1) return Buffer.byteLength(payloadData, 'utf8')
  return 0
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'TimeoutError' || /timeout/i.test(err.message)
}

function summarizeNumbers(values: number[]): NumericStats {
  if (values.length === 0) return { median: null, min: null, max: null }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
  return {
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  }
}

async function runSingleOpen(
  browser: BrowserLike,
  config: CliConfig,
  runIndex: number,
  roomLoaded: RoomLoadedState
): Promise<RunResult> {
  const context = await browser.newContext({
    viewport: { ...VIEWPORT },
    serviceWorkers: 'block'
  })

  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

    const sockets = new Map<string, SocketTracker>()
    let capturing = true

    cdp.on('Network.webSocketCreated', (event) => {
      const requestId = typeof event.requestId === 'string' ? event.requestId : ''
      const url = typeof event.url === 'string' ? event.url : ''
      if (!requestId) return
      sockets.set(requestId, {
        url: stripQuery(url),
        isCollab: isCollabWebSocketUrl(url),
        bytesReceived: 0,
        framesReceived: 0
      })
    })

    cdp.on('Network.webSocketFrameReceived', (event) => {
      if (!capturing) return
      const requestId = typeof event.requestId === 'string' ? event.requestId : ''
      const socket = sockets.get(requestId)
      if (!socket || !socket.isCollab) return

      const response = event.response as { opcode?: number; payloadData?: string } | undefined
      if (
        !response ||
        typeof response.opcode !== 'number' ||
        typeof response.payloadData !== 'string'
      ) {
        return
      }
      const bytes = frameByteLength(response.opcode, response.payloadData)
      if (bytes === 0 && response.opcode !== 1 && response.opcode !== 2) return
      socket.bytesReceived += bytes
      socket.framesReceived += 1
    })

    let filledMs = -1
    let timedOut = false
    let errorMessage: string | undefined

    // Preserve fillcheck.ts wait logic verbatim: clock starts right before goto.
    const t0 = Date.now()
    try {
      await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs })
      await page.waitForFunction(
        () => document.querySelectorAll('.ProseMirror [data-toc-id]').length > 20,
        null,
        { timeout: config.timeoutMs }
      )
      filledMs = Date.now() - t0
    } catch (err) {
      timedOut = isTimeoutError(err)
      errorMessage = err instanceof Error ? err.message : String(err)
    } finally {
      capturing = false
    }

    let headings = 0
    let dom = 0
    try {
      headings = await page.evaluate(
        () => document.querySelectorAll('.ProseMirror [data-toc-id]').length
      )
      dom = await page.evaluate(() => document.getElementsByTagName('*').length)
    } catch {
      // Keep zero counts when navigation failed before a document was reachable.
    }

    const collabSockets = [...sockets.values()].filter((s) => s.isCollab)
    const wsBytesReceived = collabSockets.reduce((sum, s) => sum + s.bytesReceived, 0)
    const wsFramesReceived = collabSockets.reduce((sum, s) => sum + s.framesReceived, 0)
    const collabWsUrl = collabSockets[0]?.url ?? null
    const passed = filledMs >= 0 && !timedOut

    const result: RunResult = {
      kind: 'run',
      run: runIndex,
      passed,
      timed_out: timedOut,
      filled_ms: filledMs,
      headings,
      dom,
      ws_bytes_received: wsBytesReceived,
      ws_frames_received: wsFramesReceived,
      collab_ws_url: collabWsUrl,
      room_loaded: roomLoaded
    }
    if (errorMessage) result.error = errorMessage
    return result
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  const config = parseCli()
  const scriptSha256 = computeFileSha256(SCRIPT_PATH)
  const { playwright, playwrightVersion } = loadPlaywright()
  const browser = await playwright.chromium.launch({
    channel: CHROME_CHANNEL,
    headless: true
  })

  const browserVersion = browser.version()
  const envHeader: EnvHeader = {
    kind: 'env',
    script_sha256: scriptSha256,
    url: config.url,
    runs: config.runs,
    timeout_ms: config.timeoutMs,
    browser_version: browserVersion,
    playwright_version: playwrightVersion,
    channel: CHROME_CHANNEL,
    viewport: { ...VIEWPORT },
    at: new Date().toISOString()
  }
  console.log(JSON.stringify(envHeader))

  const results: RunResult[] = []
  let roomWarmedInLoop = config.roomLoaded === 'warm'

  try {
    for (let i = 1; i <= config.runs; i += 1) {
      const roomLoaded: RoomLoadedState = roomWarmedInLoop ? 'warm' : config.roomLoaded
      const runResult = await runSingleOpen(browser, config, i, roomLoaded)
      results.push(runResult)
      console.log(JSON.stringify(runResult))
      if (runResult.passed) roomWarmedInLoop = true
    }
  } finally {
    await browser.close()
  }

  const passedRuns = results.filter((r) => r.passed)
  const summary: SummaryOutput = {
    kind: 'summary',
    script_sha256: scriptSha256,
    url: config.url,
    runs: results.length,
    passed: passedRuns.length,
    failed: results.length - passedRuns.length,
    browser_version: browserVersion,
    playwright_version: playwrightVersion,
    filled_ms: summarizeNumbers(passedRuns.map((r) => r.filled_ms)),
    ws_bytes_received: summarizeNumbers(passedRuns.map((r) => r.ws_bytes_received)),
    ws_frames_received: summarizeNumbers(passedRuns.map((r) => r.ws_frames_received))
  }
  console.log(JSON.stringify(summary))

  if (config.outPath) {
    mkdirSync(dirname(config.outPath), { recursive: true })
    writeFileSync(
      config.outPath,
      `${JSON.stringify({ env: envHeader, runs: results, summary }, null, 2)}\n`,
      'utf8'
    )
  }
}

if (import.meta.main) {
  await main()
}
