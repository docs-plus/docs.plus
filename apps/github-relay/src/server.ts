import { timingSafeEqual } from 'crypto'

import { WebhookRouter } from './projection/router.ts'
import type { ChannelQueue } from './queue/channelQueue.ts'
import { verifyGitHubSignature } from './security.ts'
import type { SqliteStore } from './store/sqliteStore.ts'
import type { RelayConfig } from './types.ts'

const MAX_BODY_BYTES = 5 * 1024 * 1024

function safeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function createRelayHandler(deps: {
  config: RelayConfig
  store: SqliteStore
  queue: ChannelQueue
  startedAtMs?: number
}): (req: Request) => Promise<Response> {
  const { config, store, queue } = deps
  const startedAtMs = deps.startedAtMs ?? Date.now()
  const router = new WebhookRouter(config, store, queue)

  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (req.method === 'GET' && url.pathname === '/health') {
      return Response.json({
        ok: true,
        pendingJobs: store.countPendingJobs(),
        uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000)
      })
    }

    if (req.method === 'POST' && url.pathname === '/webhook/github') {
      const contentLen = Number(req.headers.get('content-length') ?? '0')
      if (Number.isFinite(contentLen) && contentLen > MAX_BODY_BYTES) {
        return Response.json({ ok: false, error: 'Payload too large' }, { status: 413 })
      }

      const rawBytes = new Uint8Array(await req.arrayBuffer())
      if (rawBytes.byteLength > MAX_BODY_BYTES) {
        return Response.json({ ok: false, error: 'Payload too large' }, { status: 413 })
      }

      const sig = req.headers.get('x-hub-signature-256')
      if (!verifyGitHubSignature(rawBytes, sig, config.githubWebhookSecret)) {
        return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
      }

      const eventName = req.headers.get('x-github-event') || ''
      if (eventName === 'ping') {
        return Response.json({ ok: true, pong: true })
      }

      let payload: unknown
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBytes))
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
      }

      const deliveryId = req.headers.get('x-github-delivery') || ''
      if (deliveryId && !store.recordDeliveryIfNew(deliveryId, eventName)) {
        return Response.json({ ok: true, duplicate: true }, { status: 202 })
      }

      router.route(eventName, payload)
      return Response.json({ ok: true, queued: true }, { status: 202 })
    }

    if (req.method === 'POST' && url.pathname === '/internal/digest') {
      if (!config.relayAdminToken) {
        return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
      }
      const auth = req.headers.get('authorization') || ''
      const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
      if (!provided || !safeTokenEqual(provided, config.relayAdminToken)) {
        return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      }

      let body: { kind?: string; force?: boolean } = {}
      try {
        body = (await req.json()) as { kind?: string; force?: boolean }
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
      }

      if (body.kind !== 'daily' && body.kind !== 'biweekly' && body.kind !== 'monthly') {
        return Response.json(
          { ok: false, error: 'kind must be daily, biweekly, or monthly' },
          { status: 400 }
        )
      }

      const posted = await queue.runDigest(body.kind, { force: Boolean(body.force) })
      return Response.json({ ok: true, posted })
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  }
}
