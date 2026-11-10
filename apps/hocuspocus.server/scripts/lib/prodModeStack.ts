import { mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tls from 'node:tls'

import { spawnSync, type Subprocess } from 'bun'

import { freePort, waitForHttp } from './e2eHarness'

const PACKAGE_ROOT = new URL('../..', import.meta.url).pathname
const SSL_REQUEST = 80877103

// A local production-mode process must never reach a real person or a remote.
// Supabase on a closed port stops the push and email consumers and the fan-out.
const OFFLINE_ENV = {
  GLITCHTIP_DSN: '',
  NEXT_PUBLIC_GLITCHTIP_DSN: '',
  SUPABASE_URL: 'http://127.0.0.1:9',
  EMAIL_PROVIDER: '',
  SMTP_HOST: '',
  RESEND_API_KEY: '',
  SOCIAL_CARD_KINDS: 'document'
}

export interface StackBase {
  databaseUrl: string
  redisDb: number
  logFile: string
}

export interface WsProcess {
  label: string
  proc: Subprocess
  port: number
  internalUrl: string
  metricsUrl: string
}

export interface WorkerProcess {
  label: string
  proc: Subprocess
  metricsUrl: string
}

/** Production mode forces TLS on Postgres, and the local one has none, so TLS ends here. */
export const startPgTlsProxy = async (databaseUrl: string) => {
  const scratch = mkdtempSync(join(tmpdir(), 'prod-mode-stack-'))
  const key = join(scratch, 'key.pem')
  const cert = join(scratch, 'cert.pem')
  const openssl = spawnSync(
    ['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1'].concat([
      '-subj',
      '/CN=localhost',
      '-keyout',
      key,
      '-out',
      cert
    ]),
    { stderr: 'ignore' }
  )
  if (openssl.exitCode !== 0) throw new Error('openssl could not mint the proxy certificate')
  const secureContext = tls.createSecureContext({
    key: readFileSync(key),
    cert: readFileSync(cert)
  })

  const upstreamUrl = new URL(databaseUrl)
  const pgHost = upstreamUrl.hostname
  const pgPort = Number(upstreamUrl.port || 5432)
  const server = net.createServer((raw) => {
    raw.once('data', (first: Buffer) => {
      const upstream = net.connect(pgPort, pgHost)
      upstream.on('error', () => raw.destroy())
      if (first.length === 8 && first.readUInt32BE(4) === SSL_REQUEST) {
        raw.write('S')
        const secure = new tls.TLSSocket(raw, { isServer: true, secureContext })
        secure.on('error', () => upstream.destroy())
        secure.pipe(upstream)
        upstream.pipe(secure)
      } else {
        upstream.write(first)
        raw.pipe(upstream)
        upstream.pipe(raw)
      }
    })
    raw.on('error', () => undefined)
  })
  const port = freePort()
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))

  const url = new URL(upstreamUrl)
  url.hostname = '127.0.0.1'
  url.port = String(port)
  return {
    url: url.toString(),
    close: () => {
      server.close()
      rmSync(scratch, { recursive: true, force: true })
    }
  }
}

const spawnEntry = (entry: string, base: StackBase, env: Record<string, string>) => {
  const log = openSync(base.logFile, 'a')
  return Bun.spawn(['bun', entry], {
    cwd: PACKAGE_ROOT,
    stdout: log,
    stderr: log,
    env: {
      ...process.env,
      ...OFFLINE_ENV,
      NODE_ENV: 'production',
      REDIS_DB: String(base.redisDb),
      DATABASE_URL: base.databaseUrl,
      LOG_LEVEL: 'error',
      ...env
    }
  })
}

/** Throws unless the Redis extension loaded, because without it no sleep or sync runs. */
export const spawnWs = async (label: string, base: StackBase): Promise<WsProcess> => {
  const port = freePort()
  const internalPort = freePort()
  const internalUrl = `http://127.0.0.1:${internalPort}`
  const proc = spawnEntry('src/hocuspocus.server.ts', base, {
    REDIS: 'true',
    HOCUSPOCUS_PORT: String(port),
    HOCUSPOCUS_INTERNAL_HTTP_PORT: String(internalPort),
    HOCUSPOCUS_INTERNAL_HTTP_HOST: '127.0.0.1',
    HOCUSPOCUS_INTERNAL_URL: internalUrl,
    HOCUSPOCUS_LOGGER: 'false',
    HOCUSPOCUS_THROTTLE: 'false',
    WS_LOG_LEVEL: 'error'
  })
  const healthUrl = `http://127.0.0.1:${port}/health/redis`
  if (!(await waitForHttp(healthUrl, 60_000))) throw new Error(`${label} never came up`)
  const health = (await (await fetch(healthUrl)).json()) as { status?: string }
  if (health.status !== 'configured') {
    throw new Error(`${label}: RedisExtension did not load (${JSON.stringify(health)})`)
  }
  return { label, proc, port, internalUrl, metricsUrl: `${internalUrl}/metrics` }
}

/** Waits on `/metrics`, because the production `/health` also gates on VAPID and Supabase. */
export const spawnWorker = async (
  label: string,
  base: StackBase,
  concurrency: number
): Promise<WorkerProcess> => {
  const healthPort = freePort()
  const proc = spawnEntry('src/hocuspocus.worker.ts', base, {
    WORKER_HEALTH_PORT: String(healthPort),
    WORKER_LOG_LEVEL: 'error',
    BULLMQ_CONCURRENCY: String(concurrency),
    // 0 turns the reaper off, so a local stack never thins versions or purges documents.
    DOC_AUTOSAVE_RETENTION_DAYS: '0',
    DOC_DELETE_RETENTION_DAYS: '0'
  })
  const metricsUrl = `http://127.0.0.1:${healthPort}/metrics`
  if (!(await waitForHttp(metricsUrl, 60_000))) throw new Error(`${label} never came up`)
  return { label, proc, metricsUrl }
}
