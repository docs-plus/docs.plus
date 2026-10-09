/**
 * Pins #445: mail link scanners open every link, so a GET of the unsubscribe
 * link must never write. Only a POST runs the `apply_unsubscribe` RPC.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'

import { config } from '../../src/config/env'
import { signUnsubscribeToken } from '../../src/lib/unsubscribeToken'

const SECRET = 'test-unsubscribe-secret-at-least-32-chars'
const USER = '992bb85e-78f8-4747-981a-fd63d9317ff1'

let rpcCalls: Array<{ name: string; args: unknown }> = []

// Sticky across files in one `bun test` run, so keep every export other suites read.
mock.module('../../src/lib/supabase', () => ({
  SUPABASE_FETCH_TIMEOUT_MS: 10_000,
  getAnonClient: () => null,
  getServiceRoleClient: () => ({
    rpc: async (name: string, args: { p_user_id: string; p_action: string }) => {
      rpcCalls.push({ name, args })
      return {
        data: {
          success: true,
          user_id: args.p_user_id,
          action: args.p_action,
          message: 'You have been unsubscribed.'
        },
        error: null
      }
    }
  })
}))

// `config` is read once per process, and an earlier suite may already have loaded it.
const emailConfig = config.email as { unsubscribeSecret: string }
const originalSecret = emailConfig.unsubscribeSecret

describe('email unsubscribe routes', () => {
  let app: Hono
  let token: string

  beforeAll(async () => {
    emailConfig.unsubscribeSecret = SECRET
    const { default: emailRouter } = await import('../../src/api/email')
    app = new Hono()
    app.route('/api/email', emailRouter)
    token = signUnsubscribeToken({ userId: USER, action: 'digest', secret: SECRET })
  })

  afterAll(() => {
    emailConfig.unsubscribeSecret = originalSecret
  })

  beforeEach(() => {
    rpcCalls = []
  })

  test('GET with a valid token renders the confirm form and writes nothing', async () => {
    const res = await app.request(`/api/email/unsubscribe?token=${token}`)
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(html).toContain('name="confirm"')
    expect(rpcCalls).toHaveLength(0)
  })

  test('GET with a tampered token renders the invalid page and writes nothing', async () => {
    const res = await app.request(`/api/email/unsubscribe?token=${token}x`)
    const html = await res.text()

    expect(html).toContain('This unsubscribe link is invalid or has expired.')
    expect(html).not.toContain('name="confirm"')
    expect(rpcCalls).toHaveLength(0)
  })

  test('the confirm form POST unsubscribes and renders the result page', async () => {
    const res = await app.request(`/api/email/unsubscribe?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'confirm=yes'
    })
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('Unsubscribed')
    expect(rpcCalls).toEqual([
      { name: 'apply_unsubscribe', args: { p_user_id: USER, p_action: 'digest' } }
    ])
  })

  test('an RFC 8058 one-click POST still answers JSON', async () => {
    const res = await app.request(`/api/email/unsubscribe?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click'
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(rpcCalls).toHaveLength(1)
  })
})
