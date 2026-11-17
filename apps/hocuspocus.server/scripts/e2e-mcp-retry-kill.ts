/**
 * #726 content check 9: `retry@file` stays on the MCP router, so SIGKILL the REST replica that sent
 * one `edit_blocks` apply once the WS answered. Pass: one copy, and a control post shows a retry.
 * Run from apps/hocuspocus.server: bun --env-file=../../.env.local scripts/e2e-mcp-retry-kill.ts
 * --mode held|cold (default held) --redis-db 9 (an empty DB). Needs Docker, Postgres and Redis.
 */
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { spawnSync, type Subprocess } from 'bun'
import Redis from 'ioredis'
import pino from 'pino'

import { buildFixture, mulberry32 } from './lib/benchFixture'
import { decodeText, freePort, makeOpenProvider, sleep, waitForHttp } from './lib/e2eHarness'
import { spawnWorker, spawnWs, startPgTlsProxy, type WsProcess } from './lib/prodModeStack'

// As in bench-content-write.ts: `test` keeps this process's pool off TLS. Config freezes on import.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
const { prisma } = await import('../src/lib/prisma')
const { createContentClient } = await import('../src/modules/document-content/infra/contentClient')
const { findSection } = await import('../src/modules/document-content/domain/sections')
const { TOC_ID_ATTR } = await import('../src/modules/document-content/types')

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = new URL('../../..', import.meta.url).pathname
const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const mode = option('--mode', 'held')
if (mode !== 'held' && mode !== 'cold') throw new Error(`unknown --mode ${mode}`)
const redisDb = Number(option('--redis-db', '9'))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const scratch = mkdtempSync(join(tmpdir(), 'e2e-mcp-retry-kill-'))
const logFile = join(scratch, 'stack.log')
const SLUG = `e2e-mcp-retry-kill-${stamp.toLowerCase()}`
const MARKER = `check-9-marker-${stamp}`
const USER = { id: '00000000-0000-4000-8000-000000000729', email: 'check-9@docs.plus.test' }
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// The MCP router's middlewares as production declares them. Decision 5 adds a router whose
// rule names /api/mcp; until it lands, the /api router's chain is the one MCP traffic gets.
const compose = readFileSync(join(REPO_ROOT, 'docker-compose.prod.yml'), 'utf8')
const routerChain = (name: string) =>
  compose.match(new RegExp(`routers\\.${name}\\.middlewares=([^'"\\s]+)`))?.[1]
const mcpRouter = compose.match(/routers\.([\w-]+)\.rule=[^'\n]*\/api\/mcp/)?.[1]
const chainSource = mcpRouter ?? 'rest-api'
const middlewares = (routerChain(chainSource) ?? '').split(',').filter(Boolean)
const traefikImage = compose.match(/image:\s*(traefik:\S+)/)?.[1] ?? 'traefik:v3.6'

// --- One connected-app token, checked by lookup like scripts/lib/supabaseStub.ts.
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600
const claims = {
  sub: USER.id,
  client_id: 'check-9',
  role: 'authenticated',
  aud: 'authenticated',
  exp
}
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${randomBytes(16).toString('hex')}`
const authPort = freePort()
const auth = Bun.serve({
  port: authPort,
  hostname: '127.0.0.1',
  fetch: (request) =>
    new URL(request.url).pathname === '/auth/v1/user' &&
    request.headers.get('authorization') === `Bearer ${TOKEN}`
      ? Response.json({
          id: USER.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: USER.email,
          user_metadata: {},
          app_metadata: { provider: 'email' },
          is_anonymous: false
        })
      : Response.json({ code: 401, msg: 'invalid token' }, { status: 401 })
})

// --- Stack: TLS proxy, its own Redis DB, 2 WS and 1 worker (concurrency 1, as since #737).
const proxy = await startPgTlsProxy(process.env.DATABASE_URL ?? '')
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: redisDb
})
if ((await redis.dbsize()) !== 0) {
  throw new Error(`Redis DB ${redisDb} is not empty. Pick a free one with --redis-db.`)
}

const children: Subprocess[] = []
const container = `e2e-mcp-retry-kill-${process.pid}`
const stopAll = () => {
  for (const child of children) child.kill('SIGKILL')
  spawnSync(['docker', 'rm', '-f', container], { stdout: 'ignore', stderr: 'ignore' })
}
process.once('exit', stopAll)
process.once('SIGINT', () => process.exit(130))
process.once('SIGTERM', () => process.exit(143))

const base = { databaseUrl: proxy.url, redisDb, logFile }
const ws: WsProcess[] = []
for (const label of ['A', 'B']) {
  const instance = await spawnWs(label, base)
  children.push(instance.proc)
  ws.push(instance)
}
children.push((await spawnWorker('W1', base, 1)).proc)

// --- Each REST replica hops through a spy to its own WS replica, the worst case for a replay.
type Hop = { rest: string; status: number; outcome: string }
const applies: Hop[] = []
const rest = new Map<string, { proc: Subprocess; port: number }>()
let armed = false
let killed: string | null = null

const spawnSpy = (label: string, target: WsProcess) =>
  Bun.serve({
    port: freePort(),
    hostname: '127.0.0.1',
    idleTimeout: 60,
    async fetch(request) {
      const url = new URL(request.url)
      const body = await request.arrayBuffer()
      const upstream = await fetch(`${target.internalUrl}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === 'GET' ? undefined : body
      })
      const answer = await upstream.arrayBuffer()
      const isApply = /^\/internal\/documents\/[^/]+\/content$/.test(url.pathname)
      if (isApply && JSON.parse(new TextDecoder().decode(body)).mode === 'blocks') {
        const outcome = new TextDecoder().decode(answer).slice(0, 200)
        applies.push({ rest: label, status: upstream.status, outcome })
        // The WS has answered, so the write is in; the REST replica dies before it replies.
        if (armed) {
          armed = false
          killed = label
          rest.get(label)?.proc.kill('SIGKILL')
        }
      }
      return new Response(answer, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' }
      })
    }
  })

for (const [label, target] of [
  ['A', ws[0]],
  ['B', ws[1]]
] as const) {
  const spy = spawnSpy(label, target)
  const port = freePort()
  const proc = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: PACKAGE_ROOT,
    stdout: openSync(logFile, 'a'),
    stderr: openSync(logFile, 'a'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      LOG_LEVEL: 'error',
      REST_LOG_LEVEL: 'error',
      APP_PORT: String(port),
      REDIS_DB: String(redisDb),
      HOCUSPOCUS_INTERNAL_URL: `http://127.0.0.1:${spy.port}`,
      SUPABASE_URL: `http://127.0.0.1:${authPort}`,
      GLITCHTIP_DSN: ''
    }
  })
  children.push(proc)
  rest.set(label, { proc, port })
  if (!(await waitForHttp(`http://127.0.0.1:${port}/health/live`, 60_000))) {
    throw new Error(`REST ${label} never came up`)
  }
}

// --- Traefik with the real middlewares file and the production router chain.
const dynamicDir = join(scratch, 'dynamic')
mkdirSync(dynamicDir)
writeFileSync(
  join(dynamicDir, 'middlewares.yml'),
  readFileSync(join(REPO_ROOT, 'scripts/traefik/dynamic/middlewares.yml'))
)
const servers = [...rest.values()]
  .map(({ port }) => `          - url: http://host.docker.internal:${port}`)
  .join('\n')
writeFileSync(
  join(dynamicDir, 'routers.yml'),
  `http:
  routers:
    mcp:
      rule: PathPrefix(\`/api\`)
      entryPoints: [web]
      service: rest-api-mcp
      middlewares: [${middlewares.join(', ')}]
  services:
    rest-api-mcp:
      loadBalancer:
        servers:
${servers}
        healthCheck:
          path: /health/live
          interval: 5s
          timeout: 3s
`
)
const edgePort = freePort()
const started = spawnSync([
  'docker',
  'run',
  '-d',
  '--name',
  container,
  '--add-host=host.docker.internal:host-gateway',
  '-p',
  `127.0.0.1:${edgePort}:80`,
  '-v',
  `${dynamicDir}:/dyn:ro`,
  traefikImage,
  '--entrypoints.web.address=:80',
  '--providers.file.directory=/dyn',
  '--accesslog=true',
  '--accesslog.format=json',
  '--log.level=ERROR'
])
if (started.exitCode !== 0) throw new Error(`docker run failed: ${started.stderr.toString()}`)
const traefikVersion =
  spawnSync(['docker', 'exec', container, 'traefik', 'version'])
    .stdout.toString()
    .match(/Version:\s+(\S+)/)?.[1] ?? 'unknown'
const MCP_URL = `http://127.0.0.1:${edgePort}/api/mcp`
const edgeDeadline = Date.now() + 30_000
while ((await fetch(MCP_URL).catch(() => null))?.status !== 401) {
  if (Date.now() > edgeDeadline) throw new Error('Traefik never routed /api/mcp to REST')
  await sleep(250)
}

// --- MCP calls through the edge, as a connected app sends them.
let rpcId = 0
const rpc = async (method: string, params: unknown) => {
  const id = ++rpcId
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(60_000)
  })
  const raw = await response.text()
  const line = raw.trimStart().startsWith('{')
    ? raw
    : (raw
        .split('\n')
        .find((l) => l.startsWith('data:'))
        ?.slice(5) ?? '')
  const message = (() => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })()
  const text = message?.result?.content?.find((p: { type: string }) => p.type === 'text')?.text
  return { status: response.status, isError: message?.result?.isError === true, text, raw }
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const documentId = [...randomBytes(19)].map((byte) => BASE62[byte % 62]).join('')
const clientFor = (instance: WsProcess) =>
  createContentClient({
    baseUrl: instance.internalUrl,
    serviceRoleKey,
    prisma,
    logger: pino({ level: 'error' })
  })
const countMarker = (value: unknown) => JSON.stringify(value).split(MARKER).length - 1

let passed = false
let provider: { destroy: () => void } | null = null
try {
  await prisma.documentMetadata.create({
    data: { documentId, slug: SLUG, title: 'Check 9 document', ownerId: USER.id }
  })
  const fixture = buildFixture(mulberry32(727), 3 * 1024 * 1024)
  const seeded = await clientFor(ws[0]).apply({
    documentId,
    mode: 'replace',
    content: fixture.doc as never
  })
  if (seeded.status !== 'applied') throw new Error(`seed write failed: ${JSON.stringify(seeded)}`)
  while ((await prisma.documents.count({ where: { documentId } })) === 0) await sleep(500)

  if (mode === 'held') {
    const open = await makeOpenProvider(ws[0].port)(documentId, SLUG, '')
    if (!open.synced) throw new Error('the held-room provider never synced')
    provider = open.provider
  }

  const read = await clientFor(ws[0]).read(documentId)
  if (read.status !== 'ok') throw new Error(`read failed: ${read.status}`)
  const sectionId = String(
    (read.content.content ?? []).find((node) => node.type === 'heading' && node.attrs?.level === 2)
      ?.attrs?.[TOC_ID_ATTR] ?? ''
  )
  const rev = findSection(read.content, sectionId)?.rev
  if (!rev) throw new Error('no level-2 section in the fixture')

  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e-mcp-retry-kill', version: '1' }
  })
  if (init.status !== 200) throw new Error(`initialize failed: ${init.status} ${init.raw}`)

  armed = true
  const call = await rpc('tools/call', {
    name: 'edit_blocks',
    arguments: { slug: SLUG, section_id: sectionId, rev, after_block: 0, markdown: MARKER }
  })
  armed = false
  // Control: the dead replica is still in the pool for up to one health check (5 s), so one
  // of these lands on a refused connection. A retry there proves `retry@file` is live.
  const initParams = {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e-mcp-retry-kill', version: '1' }
  }
  for (let i = 0; i < 4; i++) await rpc('initialize', initParams)

  // Let a held room's 10 s idle debounce fire, then wait for every save to land.
  await sleep(2000)
  provider?.destroy()
  provider = null
  await sleep(12_000)
  const queueDeadline = Date.now() + 120_000
  let quiet = 0
  while (quiet < 3 && Date.now() < queueDeadline) {
    const depth =
      (await redis.llen('bull:store-documents:wait')) +
      (await redis.llen('bull:store-documents:active')) +
      (await redis.zcard('bull:store-documents:delayed'))
    quiet = depth === 0 ? quiet + 1 : 0
    await sleep(1000)
  }

  const head = await prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { data: true }
  })
  const copies = {
    storedHead: head ? countMarker(decodeText(head.data)) : 0,
    readViaWsA: countMarker(await clientFor(ws[0]).read(documentId)),
    readViaWsB: countMarker(await clientFor(ws[1]).read(documentId))
  }
  const edgeLog = spawnSync(['docker', 'logs', container]).stdout.toString()
  writeFileSync(join(scratch, 'edge.log'), edgeLog)
  // In send order: initialize, edit_blocks, then the four control posts. Traefik 3.6.25 logs
  // RetryAttempts 0 even after a retry, so its backoff in Overhead (ns) is the mark too.
  type EdgeLine = { RetryAttempts?: number; DownstreamStatus?: number; Overhead?: number }
  const edgePosts = edgeLog
    .split('\n')
    .filter((line) => line.includes('"RequestMethod":"POST"') && line.includes('/api/mcp'))
    .map((line) => JSON.parse(line) as EdgeLine)
    .map((entry) => ({
      status: entry.DownstreamStatus,
      overheadMs: Math.round((entry.Overhead ?? 0) / 1e5) / 10,
      retried: (entry.RetryAttempts ?? 0) > 0 || (entry.Overhead ?? 0) >= 25e6
    }))
  const retryLive = edgePosts.slice(2).some((post) => post.retried)
  passed = Object.values(copies).every((n) => n === 1) && killed !== null && retryLive

  console.log(
    JSON.stringify(
      {
        check: '#726 content check 9',
        passed,
        mode,
        traefik: { image: traefikImage, version: traefikVersion, chainSource, middlewares },
        killedRest: killed,
        blocksApplies: applies,
        client: { status: call.status, isError: call.isError, text: call.text?.slice(0, 200) },
        editRetried: edgePosts[1]?.retried ?? null,
        retryLive,
        edgePosts,
        copies,
        log: logFile
      },
      null,
      2
    )
  )
} finally {
  provider?.destroy()
  await prisma.documentMetadata.deleteMany({ where: { slug: SLUG } })
  await prisma.documents.deleteMany({ where: { documentId } })
  stopAll()
  await redis.flushdb()
  await redis.quit()
  auth.stop(true)
  proxy.close()
  await prisma.$disconnect()
  if (passed) rmSync(scratch, { recursive: true, force: true })
}
process.exit(passed ? 0 : 1)
