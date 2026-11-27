import type {
  BenchRunResult,
  BrowserContextLike,
  BrowserLike,
  ChipState,
  CliConfig,
  PadSession,
  PageLike,
  RecordedWsFrame
} from './bench-sync-chip'
import * as b from './bench-sync-chip'

export interface CheckResult {
  check: number
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail: string
  data?: Record<string, unknown>
}

export function decodeHocuspocusFrame(base64Payload: string): RecordedWsFrame['decoded'] {
  try {
    const buf = Buffer.from(base64Payload, 'base64')
    if (buf.length === 0) return null
    let offset = 0
    const readUint = () => {
      let num = 0
      for (let mult = 1; offset < buf.length; mult *= 128) {
        const byte = buf[offset++]
        num += (byte & 0x7f) * mult
        if (byte < 0x80) return num
      }
      throw new Error('EOF')
    }
    const readStr = () => {
      const len = readUint()
      if (offset + len > buf.length) throw new Error('EOF')
      return new TextDecoder().decode(buf.subarray(offset, (offset += len)))
    }
    const decoded: NonNullable<RecordedWsFrame['decoded']> = {
      documentName: readStr(),
      messageType: readUint()
    }
    if (decoded.messageType === 0 && offset < buf.length) decoded.syncType = readUint()
    else if (decoded.messageType === 5 && offset < buf.length) {
      const parsed = JSON.parse(readStr()) as { msg?: unknown }
      if (typeof parsed.msg === 'string') decoded.statelessMsg = parsed.msg
    } else if (decoded.messageType === 8 && offset < buf.length) {
      decoded.applied = readUint() === 1
    }
    return decoded
  } catch {
    return null
  }
}

const isMsg = (f: RecordedWsFrame, dir: 'sent' | 'received', type: number, docId?: string) =>
  f.direction === dir &&
  (!docId || f.decoded?.documentName === docId) &&
  f.decoded?.messageType === type

export const isSyncAckFrame = (f: RecordedWsFrame, docId?: string, applied = true) =>
  isMsg(f, 'received', 8, docId) && f.decoded?.applied === applied
export const isSyncUpdateFrame = (f: RecordedWsFrame, docId?: string) =>
  isMsg(f, 'sent', 0, docId) && f.decoded?.syncType === 2
export const isSyncPayloadFrame = (f: RecordedWsFrame, docId?: string) =>
  isMsg(f, 'sent', 0, docId) && (f.decoded?.syncType === 1 || f.decoded?.syncType === 2)
export const isStatelessSavedFrame = (f: RecordedWsFrame, docId: string) =>
  isMsg(f, 'received', 5, docId) && f.decoded?.statelessMsg === 'document:saved'

const STATE_BY_LABEL = Object.fromEntries(
  Object.entries(b.STATUS_ARIA).map(([k, v]) => [v, k])
) as Record<string, ChipState>

const readChipState = async (page: PageLike): Promise<ChipState> =>
  STATE_BY_LABEL[await b.readChipLabel(page)] ?? 'unknown'

export async function waitForPayloadAcks(
  frames: RecordedWsFrame[],
  fromIdx: number,
  timeoutMs: number,
  docId?: string,
  extraGate?: () => Promise<boolean>,
  intervalMs = 100
): Promise<number | null> {
  return b.pollUntil(
    async () => {
      const post = frames.slice(fromIdx)
      const sent = post.filter((f) => isSyncPayloadFrame(f, docId)).length
      const acks = post.filter((f) => isSyncAckFrame(f, docId))
      if (sent > 0 && acks.length >= sent && (!extraGate || (await extraGate()))) {
        await Bun.sleep(600)
        return acks.at(-1)?.wallMs ?? 0
      }
      return false
    },
    timeoutMs,
    intervalMs
  )
}

const safeIdent = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')

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
  if (proc.exitCode !== 0) throw new Error(`psql failed: ${new TextDecoder().decode(proc.stderr)}`)
  return new TextDecoder().decode(proc.stdout).trim()
}

export function cleanupBenchPads(slugPrefix: string): number {
  const safe = safeIdent(slugPrefix)
  const out = runPsql(
    `WITH deleted AS (DELETE FROM "DocumentMetadata" WHERE slug LIKE '${safe}%' RETURNING "documentId") SELECT count(*) FROM deleted;`
  )
  runPsql(`DELETE FROM "DocumentSlugEpoch" WHERE slug LIKE '${safe}%';`)
  return Number.parseInt(out || '0', 10)
}

async function fetchRestPadText(restUrl: string, docId: string, key: string) {
  const res = await fetch(
    `${restUrl}/api/documents/${encodeURIComponent(docId)}/content?format=text`,
    { headers: { Authorization: `Bearer ${key}` } }
  )
  if (!res.ok) throw new Error(`GET /api/documents/${docId}/content failed with ${res.status}`)
  const body = (await res.json()) as { data?: { version?: number; content?: string } }
  return {
    version: body.data?.version ?? 0,
    content: typeof body.data?.content === 'string' ? body.data.content : ''
  }
}

async function pollRestPadForText(
  restUrl: string,
  docId: string,
  key: string,
  needle: string,
  timeoutMs = 15_000
) {
  const first = await fetchRestPadText(restUrl, docId, key)
  if (first.content.includes(needle)) {
    return { ...first, found: true, immediateFound: true, immediateVersion: first.version }
  }
  let last = first
  const hit = await b.pollUntil(
    async () => {
      last = await fetchRestPadText(restUrl, docId, key)
      return last.content.includes(needle) ? last : false
    },
    timeoutMs,
    1000
  )
  return {
    ...(hit ?? last),
    found: hit !== null,
    immediateFound: false,
    immediateVersion: first.version
  }
}

async function execRestartCmd(cmd: string): Promise<number> {
  const start = Date.now()
  const proc = Bun.spawn(['/bin/sh', '-c', cmd], { stdout: 'pipe', stderr: 'pipe' })
  if ((await proc.exited) !== 0)
    throw new Error(`ws-restart-cmd failed: ${await new Response(proc.stderr).text()}`)
  return Date.now() - start
}

export async function runContentSafetyChecks(
  browser: BrowserLike,
  config: CliConfig,
  serviceRoleKey: string,
  slugPrefix: string,
  benchRuns: BenchRunResult[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const add = (
    check: number,
    name: string,
    ok: boolean | 'SKIP',
    detail: string,
    data?: Record<string, unknown>
  ) =>
    results.push({
      check,
      name,
      status: ok === 'SKIP' ? 'SKIP' : ok ? 'PASS' : 'FAIL',
      detail,
      ...(data ? { data } : {})
    })
  type DocSession = PadSession & { documentId: string }
  const openPad = <T>(tag: string, fn: (s: DocSession) => Promise<T>, exactSlug?: string) =>
    b.withPadSession(
      browser,
      config.baseUrl,
      exactSlug ?? `${slugPrefix}-${tag}-${Date.now()}`,
      1,
      decodeHocuspocusFrame,
      async (s) => fn({ ...s, ...(await b.fetchDocumentMetaBySlug(config.restUrl, s.slug)) })
    )
  const pollRest = (docId: string, needle: string) =>
    pollRestPadForText(config.restUrl, docId, serviceRoleKey, needle)
  const reopenAndVerify = async (
    context: BrowserContextLike,
    slug: string,
    docId: string,
    marker: string,
    waitMs: number
  ) => {
    const p2 = await context.newPage()
    await p2.goto(`${config.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' })
    await p2.waitForSelector(b.EDITOR_EDITABLE_SELECTOR)
    await Bun.sleep(waitMs)
    return {
      editorHasText: (await b.readEditorText(p2)).includes(marker),
      rest: await pollRest(docId, marker)
    }
  }
  const waitChipSettled = (page: PageLike, timeoutMs: number, intervalMs = 50) =>
    b.pollUntil(
      async () => (b.isSettledState(await readChipState(page)) ? b.readChipLabel(page) : false),
      timeoutMs,
      intervalMs
    )
  const navAndObserve = async (
    page: PageLike,
    url: string | null,
    sel = b.EDITOR_EDITABLE_SELECTOR
  ) => {
    await (url
      ? page.goto(url, { waitUntil: 'domcontentloaded' })
      : page.reload({ waitUntil: 'domcontentloaded' }))
    await page.waitForSelector('header', { timeout: 20_000 })
    await b.installPageObservers(page)
    await page.waitForSelector(sel, { timeout: 20_000 })
  }
  const fmtTransitions = (events: Array<{ state: string }>) =>
    events.map((e) => e.state).join('->') || 'none(stayed saved)'

  const c1Name = 'Y.Doc updates & WS update frames for 100 typed chars'
  if (benchRuns.length > 0) {
    const u = benchRuns.map((r) => r.typingUpdateFrames)
    const ws = benchRuns.map((r) => r.totalWsFrames)
    const d = `Measured across n=${benchRuns.length} runs: Sync/Update frames median=${b.median(u)} (${Math.min(...u)}–${Math.max(...u)}), total WS frames median=${b.median(ws)} (${Math.min(...ws)}–${Math.max(...ws)}).`
    add(1, c1Name, true, d, { updateCounts: u, wsTotals: ws })
  } else {
    add(1, c1Name, 'SKIP', 'Run with --mode all to include Check 1 from benchmark runs.')
  }

  await openPad('c2', async ({ page, slug, documentId }) => {
    const marker = 'checktwoalphamarkerzz'
    await b.installPageObservers(page)
    await page.keyboard.type(marker, { delay: 40 })
    await waitChipSettled(page, 10_000)
    await navAndObserve(page, null)
    await page.waitForSelector('header [role="status"]', { timeout: 20_000 })
    await Bun.sleep(1500)
    const postReloadLabel = await b.readChipLabel(page)
    const { chipEvents: postEvents } = await b.readPageEvents(page)
    const sawSyncedAfterReload = postEvents.some((e) => e.state === 'synced')
    const editorHasText = (await b.readEditorText(page)).includes(marker)
    const rest = await pollRest(documentId, marker)
    const ok =
      editorHasText &&
      rest.found &&
      postReloadLabel === b.STATUS_ARIA.saved &&
      !sawSyncedAfterReload
    const d = `editorHasText=${editorHasText}, restImmediateHasText=${rest.immediateFound}, restPolledHasText=${rest.found} (v${rest.version}), postReloadChip="${postReloadLabel}", sawSyncedAfterReload=${sawSyncedAfterReload}.`
    const data = {
      slug,
      documentId,
      restImmediateVersion: rest.immediateVersion,
      restFinalVersion: rest.version,
      postReloadLabel,
      sawSyncedAfterReload,
      postReloadTransitions: postEvents.map((e) => e.state)
    }
    const name =
      'Type, wait for synced, reload; text on server via REST pad read & chip settles saved'
    add(2, name, ok, d, data)
  })

  const sharedSlug = `${slugPrefix}-c3-${Date.now()}`
  const runCheck3 = async ({ page: pA }: PadSession, { page: pB }: PadSession) => {
    const mA = 'checkthreealphamarkera'
    const mB = 'checkthreebetamarkerbb'
    await pA.keyboard.type(mA, { delay: 30 })
    await Bun.sleep(2500)
    await pB.keyboard.type(` ${mB}`, { delay: 30 })
    await Bun.sleep(10_500)
    await Promise.all([pA, pB].map((p) => p.reload({ waitUntil: 'domcontentloaded' })))
    await Promise.all([pA, pB].map((p) => p.waitForSelector(b.EDITOR_EDITABLE_SELECTOR)))
    await Bun.sleep(1500)
    const [tA, tB] = await Promise.all([b.readEditorText(pA), b.readEditorText(pB)])
    const ok = tA.includes(mA) && tA.includes(mB) && tB.includes(mA) && tB.includes(mB)
    const d = `A(hasA=${tA.includes(mA)}, hasB=${tA.includes(mB)}), B(hasA=${tB.includes(mA)}, hasB=${tB.includes(mB)}).`
    add(3, 'Two browsers: type in A, B ends with same text', ok, d, { slug: sharedSlug })
  }
  await openPad('c3', (sA) => openPad('c3', (sB) => runCheck3(sA, sB), sharedSlug), sharedSlug)

  await openPad('c4', async ({ context, page, slug, documentId }) => {
    const marker = 'checkfourofflinemarker'
    await context.setOffline(true)
    await Bun.sleep(500)
    await page.keyboard.type(marker, { delay: 30 })
    await Bun.sleep(600)
    const offlineReloadOk = await page
      .reload({ waitUntil: 'domcontentloaded', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    await page.close()
    await context.setOffline(false)
    const { editorHasText, rest } = await reopenAndVerify(context, slug, documentId, marker, 2500)
    const d = `offlineReloadSucceeded=${offlineReloadOk} (SW disabled under NEXT_PUBLIC_E2E=true; reopened in same IDB context), editorHasText=${editorHasText}, restHasText=${rest.found} (v${rest.version}).`
    const name = 'Offline edit + reload/reopen + online -> server receives text'
    add(4, name, editorHasText && rest.found, d, {
      slug,
      documentId,
      offlineReloadOk,
      restVersion: rest.version
    })
  })

  await openPad('c5', async ({ context, page, slug, documentId }) => {
    const marker = 'checkfivefastcloseaaaa'
    await page.keyboard.type(marker, { delay: 20 })
    await Bun.sleep(50)
    await page.close()
    const { editorHasText, rest } = await reopenAndVerify(context, slug, documentId, marker, 2000)
    const name = 'Close tab 50 ms after last keystroke, reopen -> text is there'
    const d = `editorHasText=${editorHasText}, restHasText=${rest.found} (v${rest.version}).`
    add(5, name, editorHasText && rest.found, d, { slug, documentId, restVersion: rest.version })
  })

  if (!config.wsRestartCmd) {
    for (const [id, name] of [
      [6, 'Restart one WS replica while typing'],
      [8, 'Restart replica with no pending edits -> chip returns within 2 s']
    ] as const) {
      add(id, name, 'SKIP', 'Skipped: pass --ws-restart-cmd to automate WS restart.')
    }
  } else {
    const wsRestartCmd = config.wsRestartCmd
    await openPad('c6', async ({ page, slug, documentId }) => {
      const textToType = 'checksixrestartwhiletypinguniquealphatext'
      await b.installPageObservers(page)
      let restartPromise: Promise<number> | null = null
      for (const [i, ch] of [...textToType].entries()) {
        if (i === 15) restartPromise = execRestartCmd(wsRestartCmd)
        await page.keyboard.type(ch, { delay: 0 })
        await Bun.sleep(125)
      }
      if (restartPromise) await restartPromise
      const finalLabel = (await waitChipSettled(page, 20_000, 100)) ?? (await b.readChipLabel(page))
      const editorText = await b.readEditorText(page)
      const rest = await pollRest(documentId, textToType)
      const ok =
        editorText.includes(textToType) &&
        rest.found &&
        b.isSettledState(STATE_BY_LABEL[finalLabel] ?? 'unknown')
      const d = `editorHasFullText=${editorText.includes(textToType)} (editorLen=${editorText.length}, restLen=${rest.content.length}), restHasFullText=${rest.found} (v${rest.version}), finalChip="${finalLabel}".`
      const c6Data = {
        slug,
        documentId,
        finalLabel,
        editorTextPreview: editorText.slice(0, 120),
        restContentPreview: rest.content.slice(0, 120)
      }
      add(6, 'Restart one WS replica while typing', ok, d, c6Data)
    })

    await openPad('c8', async ({ page, frames, slug }) => {
      await b.installPageObservers(page)
      const baseIdx = frames.length
      const tStart = Date.now()
      const restartCmdDurationMs = await execRestartCmd(wsRestartCmd)
      const tDone = Date.now()
      let ackMs: number | null = null
      await b.pollUntil(
        async () => {
          const ack = frames.slice(baseIdx).find((f) => isSyncAckFrame(f))
          if (ack && ackMs === null) ackMs = ack.wallMs
          return ackMs !== null && Date.now() - ackMs >= 600
        },
        12_000,
        50
      )
      const { chipEvents } = await b.readPageEvents(page)
      const postSaved = chipEvents.filter((e) => e.wallMs >= tStart && e.state === 'saved').at(-1)
      const sawSyncedAfterRestart = chipEvents.some(
        (e) => e.wallMs >= tStart && e.state === 'synced'
      )
      const settledMs = postSaved?.wallMs ?? ackMs
      const fromRestartDoneMs = settledMs !== null ? Math.round(settledMs - tDone) : null
      const finalState = await readChipState(page)
      const ok =
        ackMs !== null &&
        finalState === 'saved' &&
        !sawSyncedAfterRestart &&
        fromRestartDoneMs !== null &&
        fromRestartDoneMs <= 2000
      const d = `restartCmdMs=${restartCmdDurationMs}, wsReconnectAckAfterRestartMs=${ackMs ? Math.round(ackMs - tDone) : 'null'}, settledAfterRestartDoneMs=${fromRestartDoneMs}, settledState=${finalState}, sawSyncedAfterRestart=${sawSyncedAfterRestart}, transitions=${fmtTransitions(chipEvents)}.`
      const c8Data = {
        slug,
        restartCmdDurationMs,
        reconnectSyncStatusWallMs: ackMs,
        fromRestartDoneMs,
        finalState,
        sawSyncedAfterRestart,
        chipEvents
      }
      add(8, 'Restart replica with no pending edits -> chip returns within 2 s', ok, d, c8Data)
    })
  }

  await openPad('c9', async ({ context, page, frames, slug, documentId }) => {
    const marker = 'checknineofflinemarker'
    const nowWall = () => page.evaluate(() => performance.timeOrigin + performance.now())
    await b.installPageObservers(page)
    await context.setOffline(true)
    await b.pollUntil(async () => (await readChipState(page)) === 'offline', 5000, 50)
    const offlineIdx = frames.length
    const offlineStartMs = await nowWall()
    await page.keyboard.type(marker, { delay: 25 })
    await Bun.sleep(1000)
    const jumpedWhileOffline = (await b.readPageEvents(page)).chipEvents.some(
      (e) => e.wallMs >= offlineStartMs && b.isSettledState(e.state)
    )
    const onlineWallMs = await nowWall()
    await context.setOffline(false)
    const finalAckMs = await waitForPayloadAcks(frames, offlineIdx, 20_000)
    const postOnlineChipEvents = (await b.readPageEvents(page)).chipEvents.filter(
      (e) => e.wallMs >= onlineWallMs
    )
    const prematureOnlineHealthy =
      finalAckMs === null ||
      postOnlineChipEvents.some((e) => b.isSettledState(e.state) && e.wallMs < finalAckMs)
    const rest = await pollRest(documentId, marker)
    const d = `jumpedWhileOffline=${jumpedWhileOffline}, prematureOnlineHealthy=${prematureOnlineHealthy}, postOnlineStates=${postOnlineChipEvents.map((e) => `${e.state}@+${Math.round(e.wallMs - onlineWallMs)}ms`).join(',')}, syncStatusTrueAt=+${finalAckMs ? Math.round(finalAckMs - onlineWallMs) : 'null'}ms, restHasText=${rest.found}.`
    const ok = !jumpedWhileOffline && !prematureOnlineHealthy && rest.found
    add(9, 'Type offline, then go online -> synced only after server holds text', ok, d, {
      slug,
      documentId,
      jumpedWhileOffline,
      prematureOnlineHealthy,
      postOnlineChipEvents
    })
  })

  await openPad('c10', async ({ context, page, frames, slug, documentId }) => {
    await page.keyboard.type('checkteninitialbase', { delay: 20 })
    await pollRest(documentId, 'checkteninitialbase')
    await context.setOffline(true)
    await Bun.sleep(400)
    await page.keyboard.type(' staleidbdelta', { delay: 20 })
    await Bun.sleep(600)
    await page.goto('about:blank')
    runPsql(
      `UPDATE "DocumentMetadata" SET "readOnly" = true, "ownerId" = '00000000-0000-4000-8000-000000000099' WHERE "documentId" = '${safeIdent(documentId)}';`
    )
    await context.setOffline(false)
    const roBaselineIdx = frames.length
    await navAndObserve(
      page,
      `${config.baseUrl}/${slug}`,
      '.docy_editor .tiptap.ProseMirror[contenteditable="false"]'
    )
    await Bun.sleep(30_000)
    const { chipEvents } = await b.readPageEvents(page)
    const sawSaving = chipEvents.some((e) => e.state === 'saving')
    const finalLabel = await b.readChipLabel(page)
    const syncStatusFalseCount = frames
      .slice(roBaselineIdx)
      .filter((f) => isSyncAckFrame(f, undefined, false)).length
    const d = `sawSaving=${sawSaving}, finalChip="${finalLabel}", syncStatusFalseFrames=${syncStatusFalseCount}, transitions=${fmtTransitions(chipEvents)}.`
    const ok = !sawSaving && finalLabel !== b.STATUS_ARIA.saving
    add(10, 'Non-owner on admin-locked pad with stale IDB waits 30 s -> never saving', ok, d, {
      slug,
      documentId,
      sawSaving,
      finalLabel,
      syncStatusFalseCount,
      chipEvents
    })
  })

  return results
}

if (import.meta.main) await b.runMain('checks')
