/**
 * `POST /api/email/validate` runs the house regex, then an MX lookup. The lookup
 * is stubbed, so the run does no live DNS: only `mx.test` has an MX record.
 */
import * as dns from 'node:dns/promises'

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'

const MX_DOMAIN = 'mx.test'

type Envelope = { success: boolean; error: { code: string } }

describe('POST /api/email/validate', () => {
  let app: Hono
  let resolveMx: ReturnType<typeof spyOn>

  beforeAll(async () => {
    resolveMx = spyOn(dns, 'resolveMx').mockImplementation((async (domain: string) => {
      if (domain === MX_DOMAIN) return [{ exchange: `mail.${MX_DOMAIN}`, priority: 10 }]
      throw Object.assign(new Error(`queryMx ENOTFOUND ${domain}`), { code: 'ENOTFOUND' })
    }) as never)
    const { default: emailRouter } = await import('../../src/api/email')
    app = new Hono()
    app.route('/api/email', emailRouter)
  })

  afterAll(() => {
    resolveMx.mockRestore()
  })

  const validate = (body: string, contentType = 'application/json') =>
    app.request('/api/email/validate', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    })

  test('an address on a domain with MX is valid', async () => {
    const res = await validate(JSON.stringify({ email: `ada@${MX_DOMAIN}` }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isValid: true })
  })

  // The domain resolves, so only the regex can refuse this address.
  test('a bad format is invalid without a lookup', async () => {
    resolveMx.mockClear()
    const res = await validate(JSON.stringify({ email: `ada..lovelace@${MX_DOMAIN}` }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isValid: false })
    expect(resolveMx).not.toHaveBeenCalled()
  })

  test('a domain with no MX is invalid', async () => {
    const res = await validate(JSON.stringify({ email: 'ada@no-mx.test' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isValid: false })
  })

  test('a body with no email gets the house-envelope 400', async () => {
    const res = await validate(JSON.stringify({ address: `ada@${MX_DOMAIN}` }))
    const data = (await res.json()) as Envelope

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR')
  })

  test('a form body reads as no email and gets the house-envelope 400', async () => {
    const res = await validate(`email=ada@${MX_DOMAIN}`, 'text/plain')
    const data = (await res.json()) as Envelope

    expect(res.status).toBe(400)
    expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR')
  })

  // Hono throws before the hook runs, so this 400 carries no house envelope here.
  test('a JSON body that does not parse is refused with 400', async () => {
    const res = await validate('{"email":')

    expect(res.status).toBe(400)
  })
})
