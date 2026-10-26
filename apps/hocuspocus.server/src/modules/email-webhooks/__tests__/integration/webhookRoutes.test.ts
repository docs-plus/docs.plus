/**
 * Pins the controller order: signature, then the svix-id claim, then the bounce
 * write. A key claimed for an unsigned request would let a forger block a real event.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { EmailBounceEvent } from '../../../../types/email.types'
import { createRouter } from '../../http/router'
import type { DedupeClaim, WebhookDedupe } from '../../infra/webhookDedupe'

const SECRET = `whsec_${Buffer.from('webhook-routes-test-secret-32-bytes!').toString('base64')}`
const SVIX_ID = 'msg_webhookRoutesTest1'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const bounceBody = JSON.stringify({
  type: 'email.bounced',
  data: {
    to: ['gone@example.test'],
    bounce: { type: 'Permanent', subType: 'General' }
  }
})

// The published vector in verifySignature.test.ts pins the crypto. This signer only
// has to sign "now", because the controller checks the timestamp against the clock.
const sign = async (id: string, timestamp: string, body: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(SECRET.slice('whsec_'.length), 'base64'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  )
  return `v1,${Buffer.from(mac).toString('base64')}`
}

// The Redis-backed dedupe's three states, in memory. `createWebhookDedupe(null)`
// always claims, so it could never show a replay being dropped.
const memoryDedupe = () => {
  const keys = new Map<string, 'pending' | 'done'>()
  const claims: string[] = []
  const dedupe: WebhookDedupe = {
    async claim(svixId): Promise<DedupeClaim> {
      claims.push(svixId)
      const state = keys.get(svixId)
      if (state) return state
      keys.set(svixId, 'pending')
      return 'claimed'
    },
    async markDone(svixId) {
      keys.set(svixId, 'done')
    },
    async release(svixId) {
      keys.delete(svixId)
    }
  }
  return { dedupe, claims }
}

describe('POST /resend', () => {
  let router: Hono
  let bounces: EmailBounceEvent[]
  let claims: string[]

  beforeEach(() => {
    bounces = []
    const memory = memoryDedupe()
    claims = memory.claims
    router = createRouter({
      webhookSecret: SECRET,
      namespaceTag: null,
      dedupe: memory.dedupe,
      recordEmailBounce: async (event) => {
        bounces.push(event)
      },
      logger: silentLogger
    })
  })

  const deliver = async (signature?: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    return router.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': SVIX_ID,
        'svix-timestamp': timestamp,
        'svix-signature': signature ?? (await sign(SVIX_ID, timestamp, bounceBody))
      },
      body: bounceBody
    })
  }

  test('a bad signature gets 401, records no bounce and claims no key', async () => {
    const forged = await sign(SVIX_ID, '1', bounceBody)
    const res = await deliver(forged)

    expect(res.status).toBe(401)
    expect(bounces).toHaveLength(0)
    expect(claims).toHaveLength(0)
  })

  test('a signed bounce records one bounce', async () => {
    const res = await deliver()

    expect(res.status).toBe(200)
    expect(bounces).toEqual([
      { email: 'gone@example.test', bounce_type: 'hard', provider: 'resend', reason: 'General' }
    ])
  })

  test('a replay of the same svix-id answers 200 and records nothing more', async () => {
    await deliver()
    const replay = await deliver()

    expect(replay.status).toBe(200)
    expect(bounces).toHaveLength(1)
  })
})
