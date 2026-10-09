import { describe, expect, test } from 'bun:test'

import { verifySignature } from '../../domain/resend/verifySignature'

// Published vector: svix/svix-webhooks, go/webhook_test.go, TestWebhookSign.
// A test that signs with our own code and then verifies proves nothing.
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const TIMESTAMP = 1614265330
const BODY = '{"test": 2432232314}'
const SIGNATURE = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='

const bytes = (text: string) => new TextEncoder().encode(text)

const check = (
  over: { id?: string; timestamp?: string; signature?: string; body?: string; now?: number } = {}
) =>
  verifySignature(
    SECRET,
    {
      id: over.id ?? ID,
      timestamp: over.timestamp ?? String(TIMESTAMP),
      signature: over.signature ?? SIGNATURE
    },
    bytes(over.body ?? BODY),
    over.now ?? TIMESTAMP
  )

describe('verifySignature', () => {
  test('the published vector verifies', async () => {
    expect(await check()).toBe('valid')
  })

  test('a match among several listed signatures verifies', async () => {
    expect(await check({ signature: `v1,AAAA v1a,xyz ${SIGNATURE}` })).toBe('valid')
  })

  test('one changed body byte fails', async () => {
    expect(await check({ body: '{"test": 2432232315}' })).toBe('mismatch')
  })

  test.each([
    ['in the past', TIMESTAMP + 301],
    ['in the future', TIMESTAMP - 301]
  ])('a timestamp more than 5 min off %s fails', async (_, now) => {
    expect(await check({ now })).toBe('expired')
  })

  test('a timestamp exactly 5 min off still verifies', async () => {
    expect(await check({ now: TIMESTAMP + 300 })).toBe('valid')
  })

  test.each(['', 'abc', '1614265330.5', '-1614265330'])(
    'a timestamp that is not a number fails: %p',
    async (timestamp) => {
      expect(await check({ timestamp })).toBe('malformed')
    }
  )

  test.each(['', 'p5jXN8AQM9LWM0D4loKWxJek', 'msg_', 'msg_p5jX-N8AQ', `msg_${'a'.repeat(65)}`])(
    'an svix-id that does not match the pattern fails: %p',
    async (id) => {
      expect(await check({ id })).toBe('malformed')
    }
  )
})
