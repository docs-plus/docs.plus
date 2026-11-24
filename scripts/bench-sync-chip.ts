import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const REPO_ROOT = resolve(import.meta.dir, '..')

const STATUS_ARIA = {
  saving: 'Syncing changes to server...',
  synced: 'Changes synced to server (visible to collaborators). Finishing save…',
  saved: 'All changes saved',
  offline: 'Offline',
  error: 'Error',
  reload: 'Reload'
} as const

type ChipState = 'saving' | 'synced' | 'saved' | 'offline' | 'error' | 'reload' | 'unknown'

interface CliConfig {
  baseUrl: string
  restUrl: string
  runs: number
  chars: number
  intervalMs: number
  cpuThrottle: number
  mode: 'bench' | 'checks' | 'all'
  outPath: string | null
  wsRestartCmd: string | null
  skipCleanup: boolean
  headless: boolean
}

interface DecodedWsFrame {
  documentName: string
  messageType: number
  syncType?: number
  applied?: boolean
  statelessMsg?: string
}

interface RecordedWsFrame {
  direction: 'sent' | 'received'
  cdpTs: number
  wallMs: number
  bytes: number
  decoded: DecodedWsFrame | null
}

interface ChipEvent {
  ariaLabel: string
  state: ChipState
  perfNow: number
  wallMs: number
}

interface KeyEventRecord {
  key: string
  perfNow: number
  wallMs: number
}

interface BenchRunResult {
  run: number
  slug: string
  documentId: string
  typingStartWallMs: number
  lastKeystrokeWallMs: number
  typingUpdateFrames: number
  typingSyncStatusTrueFrames: number
  statelessSavedFrames: number
  totalWsFramesSent: number
  totalWsFramesReceived: number
  totalWsFrames: number
  firstSyncUpdateSentWallMs: number | null
  lastSyncUpdateSentWallMs: number | null
  finalSyncStatusWallMs: number | null
  lastKeystrokeToFinalSyncStatusMs: number | null
  syncedEventsAfterStart: Array<{ wallMs: number; fromLastKeystrokeMs: number }>
  finalSyncedWallMs: number | null
  finalKeystrokeToSyncedMs: number | null
  metric1PrematureSynced: boolean
  metric2DeltaMs: number | null
  chipEvents: ChipEvent[]
}

interface CheckResult {
  check: number
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail: string
  data?: Record<string, unknown>
}

interface CdpSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: string, listener: (payload: Record<string, unknown>) => void): void
}

interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  reload(options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  close(): Promise<void>
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>
  click(selector: string): Promise<void>
  evaluate<T, A = undefined>(fn: (arg: A) => T, arg?: A): Promise<T>
  keyboard: {
    type(text: string, options?: { delay?: number }): Promise<void>
  }
}

interface BrowserContextLike {
  newPage(): Promise<PageLike>
  newCDPSession(page: PageLike): Promise<CdpSessionLike>
  setOffline(offline: boolean): Promise<void>
  close(): Promise<void>
}

interface BrowserLike {
  version(): string
  newContext(options?: {
    viewport?: { width: number; height: number }
  }): Promise<BrowserContextLike>
  close(): Promise<void>
}

interface PlaywrightModule {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<BrowserLike>
    executablePath(): string
  }
}

function printHelp(): void {
  console.log(`Usage: bun scripts/bench-sync-chip.ts [options]

Options:
  --base-url <url>        Webapp base URL (default: http://127.0.0.1:3001)
  --rest-url <url>        REST API base URL (default: http://127.0.0.1:4000)
  --runs <n>              Number of benchmark runs (default: 5)
  --chars <n>             Characters to type per run (default: 100)
  --interval-ms <n>       Interval between keystrokes in ms (default: 125)
  --cpu-throttle <rate>   CDP CPU throttling rate (default: 4)
  --mode <mode>           bench | checks | all (default: bench)
  --out <path>            Write full JSON results to path
  --ws-restart-cmd <cmd>  Shell command to restart WS replica for checks 6 & 8
  --skip-cleanup          Keep bench-m5-* rows in Postgres after running
  --headed                Launch Chromium headed instead of headless
  -h, --help              Show this help`)
}

function parsePositiveInt(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${flag} value: ${raw}`)
  }
  return parsed
}

function parseCli(): CliConfig {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string', default: 'http://127.0.0.1:3001' },
      'rest-url': { type: 'string', default: 'http://127.0.0.1:4000' },
      runs: { type: 'string', default: '5' },
      chars: { type: 'string', default: '100' },
      'interval-ms': { type: 'string', default: '125' },
      'cpu-throttle': { type: 'string', default: '4' },
      mode: { type: 'string', default: 'bench' },
      out: { type: 'string' },
      'ws-restart-cmd': { type: 'string' },
      'skip-cleanup': { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    strict: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const mode = values.mode
  if (mode !== 'bench' && mode !== 'checks' && mode !== 'all') {
    throw new Error(`Invalid --mode value: ${mode}`)
  }

  return {
    baseUrl: values['base-url'].replace(/\/$/, ''),
    restUrl: values['rest-url'].replace(/\/$/, ''),
    runs: parsePositiveInt(values.runs, '--runs'),
    chars: parsePositiveInt(values.chars, '--chars'),
    intervalMs: parsePositiveInt(values['interval-ms'], '--interval-ms'),
    cpuThrottle: parsePositiveInt(values['cpu-throttle'], '--cpu-throttle'),
    mode,
    outPath: values.out ? resolve(process.cwd(), values.out) : null,
    wsRestartCmd: values['ws-restart-cmd'] ?? null,
    skipCleanup: values['skip-cleanup'],
    headless: !values.headed
  }
}

function loadPlaywright(): PlaywrightModule {
  const requireFromPlayground = createRequire(
    resolve(REPO_ROOT, 'packages/playground/package.json')
  )
  return requireFromPlayground('playwright') as PlaywrightModule
}

function readEnvValue(key: string): string | null {
  if (process.env[key]) return process.env[key] ?? null
  const envPath = resolve(REPO_ROOT, '.env.local')
  if (!existsSync(envPath)) return null
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq).trim() !== key) continue
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    return val
  }
  return null
}

function mapAriaLabelToState(label: string): ChipState {
  if (label === STATUS_ARIA.saving) return 'saving'
  if (label === STATUS_ARIA.synced) return 'synced'
  if (label === STATUS_ARIA.saved) return 'saved'
  if (label === STATUS_ARIA.offline) return 'offline'
  if (label === STATUS_ARIA.error) return 'error'
  if (label === STATUS_ARIA.reload) return 'reload'
  return 'unknown'
}

class BinaryReader {
  private offset = 0
  constructor(private readonly buf: Uint8Array) {}

  get remaining(): number {
    return this.buf.length - this.offset
  }

  readVarUint(): number {
    let num = 0
    let mult = 1
    while (this.offset < this.buf.length) {
      const byte = this.buf[this.offset] ?? 0
      this.offset += 1
      num += (byte & 0x7f) * mult
      if (byte < 0x80) return num
      mult *= 128
    }
    throw new Error('Unexpected EOF reading varUint')
  }

  readVarString(): string {
    const len = this.readVarUint()
    if (this.offset + len > this.buf.length) {
      throw new Error('Unexpected EOF reading varString')
    }
    const slice = this.buf.subarray(this.offset, this.offset + len)
    this.offset += len
    return new TextDecoder().decode(slice)
  }
}

function decodeHocuspocusFrame(base64Payload: string): DecodedWsFrame | null {
  try {
    const bytes = new Uint8Array(Buffer.from(base64Payload, 'base64'))
    if (bytes.length === 0) return null
    const reader = new BinaryReader(bytes)
    const documentName = reader.readVarString()
    const messageType = reader.readVarUint()
    const decoded: DecodedWsFrame = { documentName, messageType }

    if (messageType === 0 && reader.remaining > 0) {
      decoded.syncType = reader.readVarUint()
    } else if (messageType === 5 && reader.remaining > 0) {
      const payload = reader.readVarString()
      try {
        const parsed = JSON.parse(payload) as { msg?: unknown }
        if (typeof parsed.msg === 'string') decoded.statelessMsg = parsed.msg
      } catch {
        // Ignore non-JSON stateless messages.
      }
    } else if (messageType === 8 && reader.remaining > 0) {
      decoded.applied = reader.readVarUint() === 1
    }

    return decoded
  } catch {
    return null
  }
}

async function attachCdpTracker(
  context: BrowserContextLike,
  page: PageLike,
  cpuThrottleRate: number
): Promise<{
  frames: RecordedWsFrame[]
  toWallMs: (cdpTs: number) => number
}> {
  const cdp = await context.newCDPSession(page)
  if (cpuThrottleRate > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate })
  }
  await cdp.send('Network.enable')

  let cdpOffsetMs: number | null = null
  const frames: RecordedWsFrame[] = []

  const toWallMs = (cdpTs: number): number => {
    if (cdpOffsetMs === null) return Date.now()
    return cdpTs * 1000 + cdpOffsetMs
  }

  cdp.on('Network.requestWillBeSent', (payload) => {
    const ts = typeof payload.timestamp === 'number' ? payload.timestamp : null
    const wall = typeof payload.wallTime === 'number' ? payload.wallTime : null
    if (ts !== null && wall !== null && cdpOffsetMs === null) {
      cdpOffsetMs = (wall - ts) * 1000
    }
  })

  const recordFrame = (direction: 'sent' | 'received', payload: Record<string, unknown>) => {
    const cdpTs = typeof payload.timestamp === 'number' ? payload.timestamp : 0
    const resp = payload.response as { opcode?: number; payloadData?: string } | undefined
    if (!resp || resp.opcode !== 2 || typeof resp.payloadData !== 'string') return
    const decoded = decodeHocuspocusFrame(resp.payloadData)
    const bytes = Buffer.byteLength(resp.payloadData, 'base64')
    frames.push({
      direction,
      cdpTs,
      wallMs: toWallMs(cdpTs),
      bytes,
      decoded
    })
  }

  cdp.on('Network.webSocketFrameSent', (payload) => recordFrame('sent', payload))
  cdp.on('Network.webSocketFrameReceived', (payload) => recordFrame('received', payload))

  return { frames, toWallMs }
}

async function installPageObservers(page: PageLike): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __benchChipEvents?: ChipEvent[]
      __benchKeyEvents?: KeyEventRecord[]
      __benchObserver?: MutationObserver
      __benchKeyHandlerAttached?: boolean
    }

    const mapLabel = (label: string): ChipState => {
      if (label === 'Syncing changes to server...') return 'saving'
      if (label === 'Changes synced to server (visible to collaborators). Finishing save…') {
        return 'synced'
      }
      if (label === 'All changes saved') return 'saved'
      if (label === 'Offline') return 'offline'
      if (label === 'Error') return 'error'
      if (label === 'Reload') return 'reload'
      return 'unknown'
    }

    w.__benchChipEvents = []
    w.__benchKeyEvents = []
    w.__benchObserver?.disconnect()

    const header = document.querySelector('header')
    if (!header) throw new Error('Header element not found')

    let lastLabel = header.querySelector('[role="status"]')?.getAttribute('aria-label') ?? ''
    const capture = () => {
      const el = header.querySelector('[role="status"]')
      const label = el?.getAttribute('aria-label') ?? ''
      if (label && label !== lastLabel) {
        lastLabel = label
        const perfNow = performance.now()
        w.__benchChipEvents?.push({
          ariaLabel: label,
          state: mapLabel(label),
          perfNow,
          wallMs: performance.timeOrigin + perfNow
        })
      }
    }

    const observer = new MutationObserver(() => capture())
    observer.observe(header, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-label']
    })
    w.__benchObserver = observer

    const editorEl = document.querySelector('.docy_editor .tiptap.ProseMirror')
    if (editorEl && !w.__benchKeyHandlerAttached) {
      w.__benchKeyHandlerAttached = true
      editorEl.addEventListener(
        'keydown',
        (evt) => {
          const ke = evt as KeyboardEvent
          const perfNow = performance.now()
          w.__benchKeyEvents?.push({
            key: ke.key,
            perfNow,
            wallMs: performance.timeOrigin + perfNow
          })
        },
        true
      )
    }
  })
}

async function readPageEvents(
  page: PageLike
): Promise<{ chipEvents: ChipEvent[]; keyEvents: KeyEventRecord[] }> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __benchChipEvents?: ChipEvent[]
      __benchKeyEvents?: KeyEventRecord[]
    }
    return {
      chipEvents: w.__benchChipEvents ?? [],
      keyEvents: w.__benchKeyEvents ?? []
    }
  })
}

async function waitForEditorAndSettled(
  page: PageLike,
  frames: RecordedWsFrame[],
  timeoutMs = 35_000
): Promise<void> {
  await page.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]', {
    timeout: timeoutMs
  })
  await page.click('.docy_editor .tiptap.ProseMirror[contenteditable="true"]')
  await page.waitForSelector('header [role="status"][aria-label="All changes saved"]', {
    timeout: timeoutMs
  })

  // Wait until no Sync/Update or SyncStatus frames arrive for 1300ms (covers proxy delay).
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const startCount = frames.length
    await Bun.sleep(1300)
    const statusLabel = await page.evaluate(
      () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
    )
    if (frames.length === startCount && statusLabel === STATUS_ARIA.saved) {
      return
    }
  }
}

async function fetchDocumentMetaBySlug(
  restUrl: string,
  slug: string
): Promise<{ documentId: string }> {
  const res = await fetch(`${restUrl}/api/documents/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    throw new Error(`GET /api/documents/${slug} failed with ${res.status}`)
  }
  const body = (await res.json()) as { data?: { documentId?: string } }
  const documentId = body.data?.documentId
  if (!documentId) {
    throw new Error(`Missing documentId for slug ${slug}`)
  }
  return { documentId }
}

async function fetchRestPadText(
  restUrl: string,
  documentId: string,
  serviceRoleKey: string
): Promise<{ version: number; content: string }> {
  const res = await fetch(
    `${restUrl}/api/documents/${encodeURIComponent(documentId)}/content?format=text`,
    {
      headers: { Authorization: `Bearer ${serviceRoleKey}` }
    }
  )
  if (!res.ok) {
    throw new Error(`GET /api/documents/${documentId}/content failed with ${res.status}`)
  }
  const body = (await res.json()) as { data?: { version?: number; content?: string } }
  return {
    version: body.data?.version ?? 0,
    content: typeof body.data?.content === 'string' ? body.data.content : ''
  }
}

async function pollRestPadForText(
  restUrl: string,
  documentId: string,
  serviceRoleKey: string,
  needle: string,
  timeoutMs = 20_000
): Promise<{ found: boolean; version: number; content: string }> {
  const deadline = Date.now() + timeoutMs
  let last = { version: 0, content: '' }
  while (Date.now() < deadline) {
    last = await fetchRestPadText(restUrl, documentId, serviceRoleKey)
    if (last.content.includes(needle)) {
      return { found: true, ...last }
    }
    await Bun.sleep(1000)
  }
  return { found: false, ...last }
}

async function runPacedTyping(
  page: PageLike,
  chars: number,
  intervalMs: number
): Promise<{ typingStartWallMs: number; typingEndWallMs: number }> {
  const alphabet = 'abcdefghij'
  const typingStartWallMs = Date.now()
  const startPerf = performance.now()
  for (let i = 0; i < chars; i += 1) {
    const targetPerf = startPerf + i * intervalMs
    const waitMs = targetPerf - performance.now()
    if (waitMs > 1) await Bun.sleep(waitMs)
    const ch = alphabet[i % alphabet.length] ?? 'a'
    await page.keyboard.type(ch, { delay: 0 })
  }
  return { typingStartWallMs, typingEndWallMs: Date.now() }
}

function median(nums: number[]): number {
  if (nums.length === 0) return Number.NaN
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? Number.NaN
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function medianOrNull(nums: number[]): number | null {
  if (nums.length === 0) return null
  return median(nums)
}

function rangeOrNull(nums: number[]): [number, number] | null {
  if (nums.length === 0) return null
  return [Math.min(...nums), Math.max(...nums)]
}

function runPsql(sql: string): string {
  const proc = Bun.spawnSync(
    [
      'docker',
      'exec',
      '-i',
      'docsy-postgres-local',
      'psql',
      '-U',
      'docsplus',
      '-d',
      'docsplus',
      '-t',
      '-A',
      '-c',
      sql
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  if (proc.exitCode !== 0) {
    throw new Error(`psql failed: ${new TextDecoder().decode(proc.stderr)}`)
  }
  return new TextDecoder().decode(proc.stdout).trim()
}

function cleanupBenchPads(slugPrefix: string): number {
  const safePrefix = slugPrefix.replace(/[^a-zA-Z0-9_-]/g, '')
  const out = runPsql(
    `WITH deleted AS (DELETE FROM "DocumentMetadata" WHERE slug LIKE '${safePrefix}%' RETURNING "documentId") SELECT count(*) FROM deleted;`
  )
  runPsql(`DELETE FROM "DocumentSlugEpoch" WHERE slug LIKE '${safePrefix}%';`)
  return Number.parseInt(out || '0', 10)
}

async function runSingleBench(
  browser: BrowserLike,
  config: CliConfig,
  runIndex: number,
  slugPrefix: string
): Promise<BenchRunResult> {
  const slug = `${slugPrefix}-r${runIndex}-${Date.now()}`
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try {
    const page = await context.newPage()
    const { frames } = await attachCdpTracker(context, page, config.cpuThrottle)

    await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
    await waitForEditorAndSettled(page, frames)
    const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)

    const baselineSentIdx = frames.length
    await installPageObservers(page)

    const { typingStartWallMs, typingEndWallMs } = await runPacedTyping(
      page,
      config.chars,
      config.intervalMs
    )
    const { keyEvents: initialKeyEvents } = await readPageEvents(page)
    const settleKeystrokeWallMs = initialKeyEvents.at(-1)?.wallMs ?? typingEndWallMs

    const deadline = Date.now() + 25_000
    let settled = false
    while (Date.now() < deadline) {
      const postFrames = frames.slice(baselineSentIdx)
      const syncPayloadSentCount = postFrames.filter(
        (f) =>
          f.direction === 'sent' &&
          f.decoded?.documentName === documentId &&
          f.decoded.messageType === 0 &&
          (f.decoded.syncType === 1 || f.decoded.syncType === 2)
      ).length
      const ackRecvCount = postFrames.filter(
        (f) =>
          f.direction === 'received' &&
          f.decoded?.documentName === documentId &&
          f.decoded.messageType === 8 &&
          f.decoded.applied === true
      ).length
      const { chipEvents } = await readPageEvents(page)
      const hasSyncedOrSavedAfter = chipEvents.some(
        (e) => e.wallMs >= settleKeystrokeWallMs && (e.state === 'synced' || e.state === 'saved')
      )
      if (
        syncPayloadSentCount > 0 &&
        ackRecvCount >= syncPayloadSentCount &&
        hasSyncedOrSavedAfter
      ) {
        await Bun.sleep(600)
        settled = true
        break
      }
      await Bun.sleep(100)
    }
    if (!settled) {
      throw new Error(`Run ${runIndex} (${slug}) timed out waiting for SyncStatus & chip settle`)
    }

    const { chipEvents, keyEvents } = await readPageEvents(page)
    const postFrames = frames.slice(baselineSentIdx)
    const sentFrames = postFrames.filter((f) => f.direction === 'sent')
    const recvFrames = postFrames.filter((f) => f.direction === 'received')

    const syncUpdates = sentFrames.filter(
      (f) =>
        f.decoded?.documentName === documentId &&
        f.decoded.messageType === 0 &&
        f.decoded.syncType === 2
    )
    const syncStatusAcks = recvFrames.filter(
      (f) =>
        f.decoded?.documentName === documentId &&
        f.decoded.messageType === 8 &&
        f.decoded.applied === true
    )
    const statelessSavedFrames = recvFrames.filter(
      (f) =>
        f.decoded?.documentName === documentId &&
        f.decoded.messageType === 5 &&
        f.decoded.statelessMsg === 'document:saved'
    ).length

    const typingStartBrowserWallMs = keyEvents[0]?.wallMs ?? typingStartWallMs
    const lastKeystrokeWallMs = keyEvents.at(-1)?.wallMs ?? settleKeystrokeWallMs
    const firstSyncUpdateSentWallMs = syncUpdates[0]?.wallMs ?? null
    const lastSyncUpdateSentWallMs = syncUpdates.at(-1)?.wallMs ?? null
    const finalSyncStatusWallMs = syncStatusAcks.at(-1)?.wallMs ?? null

    const settledEventsAfterStart = chipEvents.filter(
      (e) => e.wallMs >= typingStartBrowserWallMs && (e.state === 'synced' || e.state === 'saved')
    )
    const syncedEventsAfterStart = settledEventsAfterStart
      .filter((e) => e.state === 'synced')
      .map((e) => ({
        wallMs: e.wallMs,
        fromLastKeystrokeMs: Math.round(e.wallMs - lastKeystrokeWallMs)
      }))

    const finalSyncedWallMs = syncedEventsAfterStart.at(-1)?.wallMs ?? null
    const finalKeystrokeToSyncedMs =
      finalSyncedWallMs !== null ? Math.round(finalSyncedWallMs - lastKeystrokeWallMs) : null
    const lastKeystrokeToFinalSyncStatusMs =
      finalSyncStatusWallMs !== null
        ? Math.round(finalSyncStatusWallMs - lastKeystrokeWallMs)
        : null

    const prematureSynced =
      finalSyncStatusWallMs !== null &&
      settledEventsAfterStart.some((e) => e.wallMs < finalSyncStatusWallMs)

    const metric2DeltaMs =
      finalSyncedWallMs !== null && finalSyncStatusWallMs !== null
        ? Math.round(finalSyncedWallMs - finalSyncStatusWallMs)
        : null

    return {
      run: runIndex,
      slug,
      documentId,
      typingStartWallMs: typingStartBrowserWallMs,
      lastKeystrokeWallMs,
      typingUpdateFrames: syncUpdates.length,
      typingSyncStatusTrueFrames: syncStatusAcks.length,
      statelessSavedFrames,
      totalWsFramesSent: sentFrames.length,
      totalWsFramesReceived: recvFrames.length,
      totalWsFrames: postFrames.length,
      firstSyncUpdateSentWallMs,
      lastSyncUpdateSentWallMs,
      finalSyncStatusWallMs,
      lastKeystrokeToFinalSyncStatusMs,
      syncedEventsAfterStart,
      finalSyncedWallMs,
      finalKeystrokeToSyncedMs,
      metric1PrematureSynced: prematureSynced,
      metric2DeltaMs,
      chipEvents
    }
  } finally {
    await context.close()
  }
}

async function execRestartCmd(cmd: string): Promise<{ durationMs: number }> {
  const start = Date.now()
  const proc = Bun.spawn(['/bin/zsh', '-c', cmd], { stdout: 'pipe', stderr: 'pipe' })
  const code = await proc.exited
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`ws-restart-cmd failed (${code}): ${stderr}`)
  }
  return { durationMs: Date.now() - start }
}

async function runContentSafetyChecks(
  browser: BrowserLike,
  config: CliConfig,
  serviceRoleKey: string,
  slugPrefix: string,
  benchRuns: BenchRunResult[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  // Check 1: Y.Doc updates / WS update frames for 100 chars
  if (benchRuns.length > 0) {
    const updateCounts = benchRuns.map((r) => r.typingUpdateFrames)
    const wsTotals = benchRuns.map((r) => r.totalWsFrames)
    results.push({
      check: 1,
      name: 'Y.Doc updates & WS update frames for 100 typed chars',
      status: 'PASS',
      detail: `Measured across n=${benchRuns.length} runs: Sync/Update frames median=${median(updateCounts)} (${Math.min(...updateCounts)}–${Math.max(...updateCounts)}), total WS frames median=${median(wsTotals)} (${Math.min(...wsTotals)}–${Math.max(...wsTotals)}).`,
      data: { updateCounts, wsTotals }
    })
  } else {
    results.push({
      check: 1,
      name: 'Y.Doc updates & WS update frames for 100 typed chars',
      status: 'SKIP',
      detail: 'Run with --mode all to include Check 1 from benchmark runs.'
    })
  }

  // Check 2: Type, wait for "synced", reload. Text is on server via REST pad read.
  {
    const slug = `${slugPrefix}-c2-${Date.now()}`
    const marker = 'checktwoalphamarkerzz'
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const page = await context.newPage()
      const { frames } = await attachCdpTracker(context, page, 1)
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(page, frames)
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)
      await installPageObservers(page)
      await page.keyboard.type(marker, { delay: 40 })

      const syncedDeadline = Date.now() + 10_000
      while (Date.now() < syncedDeadline) {
        const label = await page.evaluate(
          () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
        )
        if (label === STATUS_ARIA.synced || label === STATUS_ARIA.saved) break
        await Bun.sleep(50)
      }

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('header', { timeout: 20_000 })
      await installPageObservers(page)
      await page.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]', {
        timeout: 20_000
      })
      await page.waitForSelector('header [role="status"]', { timeout: 20_000 })
      await Bun.sleep(1500)
      const postReloadLabel = await page.evaluate(
        () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
      )
      const { chipEvents: postReloadChipEvents } = await readPageEvents(page)
      const sawSyncedAfterReload = postReloadChipEvents.some((e) => e.state === 'synced')
      const chipSettledSaved = postReloadLabel === STATUS_ARIA.saved && !sawSyncedAfterReload
      const editorText = await page.evaluate(
        () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
      )
      const restImmediate = await fetchRestPadText(config.restUrl, documentId, serviceRoleKey)
      const restPolled = restImmediate.content.includes(marker)
        ? { found: true, ...restImmediate }
        : await pollRestPadForText(config.restUrl, documentId, serviceRoleKey, marker, 15_000)

      const passed = editorText.includes(marker) && restPolled.found && chipSettledSaved
      results.push({
        check: 2,
        name: 'Type, wait for synced, reload; text on server via REST pad read & chip settles saved',
        status: passed ? 'PASS' : 'FAIL',
        detail: `editorHasText=${editorText.includes(marker)}, restImmediateHasText=${restImmediate.content.includes(marker)}, restPolledHasText=${restPolled.found} (v${restPolled.version}), postReloadChip="${postReloadLabel}", sawSyncedAfterReload=${sawSyncedAfterReload}.`,
        data: {
          slug,
          documentId,
          restImmediateVersion: restImmediate.version,
          restFinalVersion: restPolled.version,
          postReloadLabel,
          sawSyncedAfterReload,
          postReloadTransitions: postReloadChipEvents.map((e) => e.state)
        }
      })
    } finally {
      await context.close()
    }
  }

  // Check 3: Two browsers: type in A. B ends with the same text.
  {
    const slug = `${slugPrefix}-c3-${Date.now()}`
    const markerA = 'checkthreealphamarkera'
    const markerB = 'checkthreebetamarkerbb'
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const pageA = await ctxA.newPage()
      const pageB = await ctxB.newPage()
      const trackA = await attachCdpTracker(ctxA, pageA, 1)
      const trackB = await attachCdpTracker(ctxB, pageB, 1)
      await pageA.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(pageA, trackA.frames)
      await pageB.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(pageB, trackB.frames)

      await pageA.keyboard.type(markerA, { delay: 30 })
      await Bun.sleep(2500)
      await pageB.keyboard.type(` ${markerB}`, { delay: 30 })
      await Bun.sleep(10_500)

      await pageA.reload({ waitUntil: 'domcontentloaded' })
      await pageB.reload({ waitUntil: 'domcontentloaded' })
      await pageA.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]')
      await pageB.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]')
      await Bun.sleep(1500)

      const textA = await pageA.evaluate(
        () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
      )
      const textB = await pageB.evaluate(
        () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
      )
      const passed =
        textA.includes(markerA) &&
        textA.includes(markerB) &&
        textB.includes(markerA) &&
        textB.includes(markerB)
      results.push({
        check: 3,
        name: 'Two browsers: type in A, B ends with same text',
        status: passed ? 'PASS' : 'FAIL',
        detail: `A(hasA=${textA.includes(markerA)}, hasB=${textA.includes(markerB)}), B(hasA=${textB.includes(markerA)}, hasB=${textB.includes(markerB)}).`,
        data: { slug }
      })
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  }

  // Check 4: Go offline, type, reload offline (or close offline & reopen online when SW disabled), go online; server receives text.
  {
    const slug = `${slugPrefix}-c4-${Date.now()}`
    const marker = 'checkfourofflinemarker'
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const page = await context.newPage()
      const { frames } = await attachCdpTracker(context, page, 1)
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(page, frames)
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)

      await context.setOffline(true)
      await Bun.sleep(500)
      await page.keyboard.type(marker, { delay: 30 })
      await Bun.sleep(600)

      let offlineReloadOk = false
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 3000 })
        offlineReloadOk = true
      } catch {
        offlineReloadOk = false
      }

      // Close offline tab so old tab cannot sync early, then go online and reopen in same context (IDB preserved).
      await page.close()
      await context.setOffline(false)
      const page2 = await context.newPage()
      await page2.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await page2.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]')
      await Bun.sleep(2500)
      const editorText = await page2.evaluate(
        () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
      )
      const rest = await pollRestPadForText(
        config.restUrl,
        documentId,
        serviceRoleKey,
        marker,
        15_000
      )
      const passed = editorText.includes(marker) && rest.found
      results.push({
        check: 4,
        name: 'Offline edit + reload/reopen + online -> server receives text',
        status: passed ? 'PASS' : 'FAIL',
        detail: `offlineReloadSucceeded=${offlineReloadOk} (SW disabled under NEXT_PUBLIC_E2E=true; reopened in same IDB context), editorHasText=${editorText.includes(marker)}, restHasText=${rest.found} (v${rest.version}).`,
        data: { slug, documentId, offlineReloadOk, restVersion: rest.version }
      })
    } finally {
      await context.close()
    }
  }

  // Check 5: Close the tab 50 ms after the last keystroke, then reopen. Text is there.
  {
    const slug = `${slugPrefix}-c5-${Date.now()}`
    const marker = 'checkfivefastcloseaaaa'
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const page = await context.newPage()
      const { frames } = await attachCdpTracker(context, page, 1)
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(page, frames)
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)

      await page.keyboard.type(marker, { delay: 20 })
      await Bun.sleep(50)
      await page.close()

      const page2 = await context.newPage()
      await page2.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await page2.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="true"]')
      await Bun.sleep(2000)
      const editorText = await page2.evaluate(
        () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
      )
      const rest = await pollRestPadForText(
        config.restUrl,
        documentId,
        serviceRoleKey,
        marker,
        15_000
      )
      const passed = editorText.includes(marker) && rest.found
      results.push({
        check: 5,
        name: 'Close tab 50 ms after last keystroke, reopen -> text is there',
        status: passed ? 'PASS' : 'FAIL',
        detail: `editorHasText=${editorText.includes(marker)}, restHasText=${rest.found} (v${rest.version}).`,
        data: { slug, documentId, restVersion: rest.version }
      })
    } finally {
      await context.close()
    }
  }

  // Check 6 & Check 8: WS replica restart
  if (!config.wsRestartCmd) {
    results.push({
      check: 6,
      name: 'Restart one WS replica while typing',
      status: 'SKIP',
      detail: 'Skipped: pass --ws-restart-cmd to automate WS restart.'
    })
    results.push({
      check: 8,
      name: 'Restart replica with no pending edits -> chip returns within 2 s',
      status: 'SKIP',
      detail: 'Skipped: pass --ws-restart-cmd to automate WS restart.'
    })
  } else {
    // Check 6
    {
      const slug = `${slugPrefix}-c6-${Date.now()}`
      const textToType = 'checksixrestartwhiletypinguniquealphatext'
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      try {
        const page = await context.newPage()
        const { frames } = await attachCdpTracker(context, page, 1)
        await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
        await waitForEditorAndSettled(page, frames)
        const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)
        await installPageObservers(page)

        let restartPromise: Promise<{ durationMs: number }> | null = null
        for (let i = 0; i < textToType.length; i += 1) {
          if (i === 15) {
            restartPromise = execRestartCmd(config.wsRestartCmd)
          }
          await page.keyboard.type(textToType[i] ?? 'a', { delay: 0 })
          await Bun.sleep(125)
        }
        if (restartPromise) await restartPromise

        const settleDeadline = Date.now() + 20_000
        let finalLabel = ''
        while (Date.now() < settleDeadline) {
          finalLabel = await page.evaluate(
            () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
          )
          if (finalLabel === STATUS_ARIA.synced || finalLabel === STATUS_ARIA.saved) break
          await Bun.sleep(100)
        }

        const editorText = await page.evaluate(
          () => document.querySelector('.docy_editor .tiptap.ProseMirror')?.textContent ?? ''
        )
        const rest = await pollRestPadForText(
          config.restUrl,
          documentId,
          serviceRoleKey,
          textToType,
          15_000
        )
        const passed =
          editorText.includes(textToType) &&
          rest.found &&
          (finalLabel === STATUS_ARIA.synced || finalLabel === STATUS_ARIA.saved)
        results.push({
          check: 6,
          name: 'Restart one WS replica while typing',
          status: passed ? 'PASS' : 'FAIL',
          detail: `editorHasFullText=${editorText.includes(textToType)} (editorLen=${editorText.length}, restLen=${rest.content.length}), restHasFullText=${rest.found} (v${rest.version}), finalChip="${finalLabel}".`,
          data: {
            slug,
            documentId,
            finalLabel,
            editorTextPreview: editorText.slice(0, 120),
            restContentPreview: rest.content.slice(0, 120)
          }
        })
      } finally {
        await context.close()
      }
    }

    // Check 8
    {
      const slug = `${slugPrefix}-c8-${Date.now()}`
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      try {
        const page = await context.newPage()
        const { frames } = await attachCdpTracker(context, page, 1)
        await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
        await waitForEditorAndSettled(page, frames)
        await installPageObservers(page)

        const baselineIdx = frames.length
        const tRestartStart = Date.now()
        const { durationMs: restartCmdDurationMs } = await execRestartCmd(config.wsRestartCmd)
        const tRestartDone = Date.now()

        let reconnectSyncStatusWallMs: number | null = null
        const deadline = Date.now() + 12_000
        while (Date.now() < deadline) {
          const postFrames = frames.slice(baselineIdx)
          const ack = postFrames.find(
            (f) =>
              f.direction === 'received' &&
              f.decoded?.messageType === 8 &&
              f.decoded.applied === true
          )
          if (ack && reconnectSyncStatusWallMs === null) {
            reconnectSyncStatusWallMs = ack.wallMs
          }

          if (reconnectSyncStatusWallMs !== null && Date.now() - reconnectSyncStatusWallMs >= 600) {
            break
          }
          await Bun.sleep(50)
        }

        const { chipEvents } = await readPageEvents(page)
        const postRestartSaved = chipEvents
          .filter((e) => e.wallMs >= tRestartStart && e.state === 'saved')
          .at(-1)
        const sawSyncedAfterRestart = chipEvents.some(
          (e) => e.wallMs >= tRestartStart && e.state === 'synced'
        )
        const settledWallMs = postRestartSaved?.wallMs ?? reconnectSyncStatusWallMs
        const fromRestartDoneMs =
          settledWallMs !== null ? Math.round(settledWallMs - tRestartDone) : null
        const currentLabel = await page.evaluate(
          () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
        )
        const finalState = mapAriaLabelToState(currentLabel)
        const passed =
          reconnectSyncStatusWallMs !== null &&
          finalState === 'saved' &&
          !sawSyncedAfterRestart &&
          fromRestartDoneMs !== null &&
          fromRestartDoneMs <= 2000

        results.push({
          check: 8,
          name: 'Restart replica with no pending edits -> chip returns within 2 s',
          status: passed ? 'PASS' : 'FAIL',
          detail: `restartCmdMs=${restartCmdDurationMs}, wsReconnectAckAfterRestartMs=${reconnectSyncStatusWallMs ? Math.round(reconnectSyncStatusWallMs - tRestartDone) : 'null'}, settledAfterRestartDoneMs=${fromRestartDoneMs}, settledState=${finalState}, sawSyncedAfterRestart=${sawSyncedAfterRestart}, transitions=${chipEvents.map((e) => e.state).join('->') || 'none(stayed saved)'}.`,
          data: {
            slug,
            restartCmdDurationMs,
            reconnectSyncStatusWallMs,
            fromRestartDoneMs,
            finalState,
            sawSyncedAfterRestart,
            chipEvents
          }
        })
      } finally {
        await context.close()
      }
    }
  }

  // Check 9: Type offline, then go online. "Synced" shows only after the server holds the text.
  {
    const slug = `${slugPrefix}-c9-${Date.now()}`
    const marker = 'checknineofflinemarker'
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const page = await context.newPage()
      const { frames } = await attachCdpTracker(context, page, 1)
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(page, frames)
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)
      await installPageObservers(page)

      await context.setOffline(true)
      const offlineDeadline = Date.now() + 5000
      while (Date.now() < offlineDeadline) {
        const label = await page.evaluate(
          () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
        )
        if (label === STATUS_ARIA.offline) break
        await Bun.sleep(50)
      }

      const offlineBaselineIdx = frames.length
      const offlineEditStartWallMs = await page.evaluate(
        () => performance.timeOrigin + performance.now()
      )
      await page.keyboard.type(marker, { delay: 25 })
      await Bun.sleep(1000)

      const { chipEvents: whileOffline } = await readPageEvents(page)
      const jumpedWhileOffline = whileOffline.some(
        (e) => e.wallMs >= offlineEditStartWallMs && (e.state === 'synced' || e.state === 'saved')
      )

      const onlineWallMs = await page.evaluate(() => performance.timeOrigin + performance.now())
      await context.setOffline(false)

      const syncDeadline = Date.now() + 20_000
      let finalSyncStatusTrueWallMs: number | null = null
      while (Date.now() < syncDeadline) {
        const postFrames = frames.slice(offlineBaselineIdx)
        const syncUpdateSent = postFrames.filter(
          (f) =>
            f.direction === 'sent' &&
            f.decoded?.messageType === 0 &&
            (f.decoded.syncType === 1 || f.decoded.syncType === 2)
        )
        const syncStatusAcks = postFrames.filter(
          (f) =>
            f.direction === 'received' && f.decoded?.messageType === 8 && f.decoded.applied === true
        )
        if (syncUpdateSent.length > 0 && syncStatusAcks.length >= syncUpdateSent.length) {
          finalSyncStatusTrueWallMs = syncStatusAcks.at(-1)?.wallMs ?? null
          await Bun.sleep(600)
          break
        }
        await Bun.sleep(50)
      }

      const { chipEvents } = await readPageEvents(page)
      const postOnlineChipEvents = chipEvents.filter((e) => e.wallMs >= onlineWallMs)
      const prematureOnlineHealthy =
        finalSyncStatusTrueWallMs === null ||
        postOnlineChipEvents.some(
          (e) =>
            (e.state === 'synced' || e.state === 'saved') && e.wallMs < finalSyncStatusTrueWallMs
        )
      const rest = await pollRestPadForText(
        config.restUrl,
        documentId,
        serviceRoleKey,
        marker,
        15_000
      )
      const passed = !jumpedWhileOffline && !prematureOnlineHealthy && rest.found

      results.push({
        check: 9,
        name: 'Type offline, then go online -> synced only after server holds text',
        status: passed ? 'PASS' : 'FAIL',
        detail: `jumpedWhileOffline=${jumpedWhileOffline}, prematureOnlineHealthy=${prematureOnlineHealthy}, postOnlineStates=${postOnlineChipEvents.map((e) => `${e.state}@+${Math.round(e.wallMs - onlineWallMs)}ms`).join(',')}, syncStatusTrueAt=+${finalSyncStatusTrueWallMs ? Math.round(finalSyncStatusTrueWallMs - onlineWallMs) : 'null'}ms, restHasText=${rest.found}.`,
        data: { slug, documentId, jumpedWhileOffline, prematureOnlineHealthy, postOnlineChipEvents }
      })
    } finally {
      await context.close()
    }
  }

  // Check 10: Non-owner on an admin-locked pad with stale IndexedDB copy waits 30 s. Chip never shows "saving".
  {
    const slug = `${slugPrefix}-c10-${Date.now()}`
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      const page = await context.newPage()
      const { frames } = await attachCdpTracker(context, page, 1)
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await waitForEditorAndSettled(page, frames)
      const { documentId } = await fetchDocumentMetaBySlug(config.restUrl, slug)

      await page.keyboard.type('checkteninitialbase', { delay: 20 })
      await pollRestPadForText(
        config.restUrl,
        documentId,
        serviceRoleKey,
        'checkteninitialbase',
        15_000
      )

      // Create stale IndexedDB delta while offline, then navigate away before going back online.
      await context.setOffline(true)
      await Bun.sleep(400)
      await page.keyboard.type(' staleidbdelta', { delay: 20 })
      await Bun.sleep(600)
      await page.goto('about:blank')

      // Lock pad in Postgres as admin-locked (readOnly=true, non-null ownerId different from anon viewer).
      const safeDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, '')
      runPsql(
        `UPDATE "DocumentMetadata" SET "readOnly" = true, "ownerId" = '00000000-0000-4000-8000-000000000099' WHERE "documentId" = '${safeDocId}';`
      )

      await context.setOffline(false)
      const roBaselineIdx = frames.length
      await page.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('header', { timeout: 20_000 })
      await installPageObservers(page)
      await page.waitForSelector('.docy_editor .tiptap.ProseMirror[contenteditable="false"]', {
        timeout: 20_000
      })

      await Bun.sleep(30_000)

      const { chipEvents } = await readPageEvents(page)
      const sawSaving = chipEvents.some((e) => e.state === 'saving')
      const finalLabel = await page.evaluate(
        () => document.querySelector('header [role="status"]')?.getAttribute('aria-label') ?? ''
      )
      const syncStatusFalseCount = frames
        .slice(roBaselineIdx)
        .filter(
          (f) =>
            f.direction === 'received' &&
            f.decoded?.messageType === 8 &&
            f.decoded.applied === false
        ).length

      const passed = !sawSaving && finalLabel !== STATUS_ARIA.saving
      results.push({
        check: 10,
        name: 'Non-owner on admin-locked pad with stale IDB waits 30 s -> never saving',
        status: passed ? 'PASS' : 'FAIL',
        detail: `sawSaving=${sawSaving}, finalChip="${finalLabel}", syncStatusFalseFrames=${syncStatusFalseCount}, transitions=${chipEvents.map((e) => e.state).join('->') || 'none(stayed saved)'}.`,
        data: { slug, documentId, sawSaving, finalLabel, syncStatusFalseCount, chipEvents }
      })
    } finally {
      await context.close()
    }
  }

  return results
}

async function main(): Promise<void> {
  const config = parseCli()
  const playwright = loadPlaywright()
  const slugPrefix = `bench-m5-${Date.now().toString(36)}`
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
  let checks: CheckResult[] = []

  try {
    if (config.mode === 'bench' || config.mode === 'all') {
      for (let i = 1; i <= config.runs; i += 1) {
        const result = await runSingleBench(browser, config, i, slugPrefix)
        benchRuns.push(result)
        console.log(
          `[run ${i}/${config.runs}] slug=${result.slug} premature=${result.metric1PrematureSynced} syncedMs=${result.finalKeystrokeToSyncedMs} syncStatusMs=${result.lastKeystrokeToFinalSyncStatusMs} deltaMs=${result.metric2DeltaMs} updates=${result.typingUpdateFrames} acks=${result.typingSyncStatusTrueFrames} totalWs=${result.totalWsFrames}`
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
      for (const c of checks) {
        console.log(`[check ${c.check}] ${c.status}: ${c.name} — ${c.detail}`)
      }
    }
  } finally {
    await browser.close()
    if (!config.skipCleanup) {
      const removed = cleanupBenchPads(slugPrefix)
      console.log(`[bench-sync-chip] cleaned ${removed} Postgres scratch rows (${slugPrefix}*)`)
    }
  }

  const metric1Count = benchRuns.filter((r) => r.metric1PrematureSynced).length
  const metric2Vals = benchRuns.map((r) => r.metric2DeltaMs).filter((v): v is number => v !== null)
  const rttVals = benchRuns
    .map((r) => r.lastKeystrokeToFinalSyncStatusMs)
    .filter((v): v is number => v !== null)
  const syncedVals = benchRuns
    .map((r) => r.finalKeystrokeToSyncedMs)
    .filter((v): v is number => v !== null)
  const updateVals = benchRuns.map((r) => r.typingUpdateFrames)
  const wsTotalVals = benchRuns.map((r) => r.totalWsFrames)

  const summary = {
    browserVersion,
    executablePath,
    config: {
      runs: config.runs,
      chars: config.chars,
      intervalMs: config.intervalMs,
      cpuThrottle: config.cpuThrottle,
      mode: config.mode
    },
    aggregates:
      benchRuns.length > 0
        ? {
            metric1PrematureCount: metric1Count,
            metric1TotalRuns: benchRuns.length,
            metric2MedianMs: medianOrNull(metric2Vals),
            metric2RangeMs: rangeOrNull(metric2Vals),
            keystrokeToSyncedMedianMs: medianOrNull(syncedVals),
            keystrokeToSyncedRangeMs: rangeOrNull(syncedVals),
            keystrokeToSyncStatusMedianMs: medianOrNull(rttVals),
            keystrokeToSyncStatusRangeMs: rangeOrNull(rttVals),
            updateFramesMedian: medianOrNull(updateVals),
            updateFramesRange: rangeOrNull(updateVals),
            totalWsFramesMedian: medianOrNull(wsTotalVals),
            totalWsFramesRange: rangeOrNull(wsTotalVals)
          }
        : null,
    runs: benchRuns,
    checks
  }

  if (summary.aggregates) {
    const fmtRange = (r: [number, number] | null) => (r ? `${r[0]}..${r[1]}ms` : 'n/a')
    console.log(
      `[summary] Metric(1)=${summary.aggregates.metric1PrematureCount}/${summary.aggregates.metric1TotalRuns} | Metric(2) median=${summary.aggregates.metric2MedianMs ?? 'n/a'}ms (${fmtRange(summary.aggregates.metric2RangeMs)}) | WS RTT median=${summary.aggregates.keystrokeToSyncStatusMedianMs ?? 'n/a'}ms (${fmtRange(summary.aggregates.keystrokeToSyncStatusRangeMs)})`
    )
  }

  if (config.outPath) {
    mkdirSync(dirname(config.outPath), { recursive: true })
    writeFileSync(config.outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(`[bench-sync-chip] wrote JSON report to ${config.outPath}`)
  }
}

await main()
