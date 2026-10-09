import { describe, expect, test } from 'bun:test'

import { type EmailConfig, resolveEmailConfig, resolveWebhookSecret } from '../email'

type EmailEnv = Parameters<typeof resolveEmailConfig>[0]

// The parsed shape env.schema hands over when nothing email-related is set.
const UNSET: EmailEnv = {
  EMAIL_PROVIDER: undefined,
  EMAIL_FROM: undefined,
  RESEND_API_KEY: undefined,
  SENDGRID_API_KEY: undefined,
  SMTP_HOST: '',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_SECURE: undefined,
  PUBLIC_RESTAPI_URL: undefined,
  APP_URL: 'https://docs.plus'
}

const resolve = (over: Partial<EmailEnv>): EmailConfig => resolveEmailConfig({ ...UNSET, ...over })

const SMTP_READY: Partial<EmailEnv> = {
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'Acme Docs <notify@acme.com>',
  SMTP_HOST: 'smtp.acme.com'
}

const problemsOf = (result: EmailConfig): string[] =>
  result.status === 'invalid' ? result.problems : []

const smtpOf = (result: EmailConfig) => {
  if (result.status !== 'ready' || result.provider.name !== 'smtp') {
    throw new Error(`expected a ready smtp config, got ${JSON.stringify(result)}`)
  }
  return result.provider
}

describe('resolveEmailConfig', () => {
  describe('off and invalid without EMAIL_PROVIDER', () => {
    test('nothing set is off', () => {
      expect(resolve({})).toEqual({ status: 'off' })
    })

    test('an empty EMAIL_PROVIDER with no keys is off', () => {
      expect(resolve({ EMAIL_PROVIDER: '  ' })).toEqual({ status: 'off' })
    })

    test.each([
      ['SMTP_HOST', { SMTP_HOST: 'smtp.acme.com' }],
      ['RESEND_API_KEY', { RESEND_API_KEY: 're_123' }],
      ['SENDGRID_API_KEY', { SENDGRID_API_KEY: 'SG.123' }]
    ])('a leftover %s holds mail', (_, over) => {
      expect(resolve(over)).toEqual({
        status: 'invalid',
        problems: ['set EMAIL_PROVIDER=resend or smtp']
      })
    })
  })

  describe('EMAIL_PROVIDER values', () => {
    test('sendgrid is invalid and names the SMTP relay', () => {
      const [problem] = problemsOf(resolve({ ...SMTP_READY, EMAIL_PROVIDER: 'sendgrid' }))
      expect(problem).toContain('EMAIL_PROVIDER=smtp')
      expect(problem).toContain('SendGrid SMTP relay')
    })

    test('an unknown value is invalid and names it', () => {
      expect(problemsOf(resolve({ ...SMTP_READY, EMAIL_PROVIDER: 'postmark' }))).toEqual([
        'EMAIL_PROVIDER=postmark is not supported; use resend or smtp'
      ])
    })

    test('a missing EMAIL_FROM is invalid', () => {
      expect(problemsOf(resolve({ ...SMTP_READY, EMAIL_FROM: '' }))).toEqual([
        'EMAIL_FROM is required'
      ])
    })

    test('resend without RESEND_API_KEY is invalid', () => {
      expect(
        problemsOf(resolve({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'notify@acme.com' }))
      ).toEqual(['RESEND_API_KEY is required for EMAIL_PROVIDER=resend'])
    })

    test('smtp without SMTP_HOST is invalid', () => {
      expect(problemsOf(resolve({ ...SMTP_READY, SMTP_HOST: '' }))).toEqual([
        'SMTP_HOST is required for EMAIL_PROVIDER=smtp'
      ])
    })

    test('resend is ready', () => {
      expect(
        resolve({
          EMAIL_PROVIDER: 'resend',
          EMAIL_FROM: 'notify@acme.com',
          RESEND_API_KEY: 're_123'
        })
      ).toEqual({
        status: 'ready',
        from: 'notify@acme.com',
        provider: { name: 'resend', apiKey: 're_123' },
        keyNamespace: 'docs.plus'
      })
    })

    test('smtp is ready', () => {
      expect(resolve(SMTP_READY)).toEqual({
        status: 'ready',
        from: 'Acme Docs <notify@acme.com>',
        provider: { name: 'smtp', host: 'smtp.acme.com', port: 587, secure: false },
        keyNamespace: 'docs.plus'
      })
    })
  })

  describe('SMTP_SECURE', () => {
    test('unset on port 465 is secure', () => {
      expect(smtpOf(resolve({ ...SMTP_READY, SMTP_PORT: 465 })).secure).toBe(true)
    })

    test('unset on port 587 is not secure', () => {
      expect(smtpOf(resolve({ ...SMTP_READY, SMTP_PORT: 587 })).secure).toBe(false)
    })

    test('an explicit false wins on port 465', () => {
      expect(smtpOf(resolve({ ...SMTP_READY, SMTP_PORT: 465, SMTP_SECURE: 'false' })).secure).toBe(
        false
      )
    })

    test('an empty value counts as unset', () => {
      expect(smtpOf(resolve({ ...SMTP_READY, SMTP_PORT: 465, SMTP_SECURE: '' })).secure).toBe(true)
    })

    test('any other value is invalid and names SMTP_SECURE', () => {
      expect(problemsOf(resolve({ ...SMTP_READY, SMTP_SECURE: 'yes' }))).toEqual([
        'SMTP_SECURE must be true or false'
      ])
    })
  })

  describe('SMTP auth', () => {
    test('no user and no password means no auth', () => {
      expect(smtpOf(resolve(SMTP_READY)).auth).toBeUndefined()
    })

    test('a user and a password give auth', () => {
      expect(smtpOf(resolve({ ...SMTP_READY, SMTP_USER: 'u', SMTP_PASS: 'p' })).auth).toEqual({
        user: 'u',
        pass: 'p'
      })
    })

    test('a user with an empty password is invalid and names SMTP_PASS', () => {
      expect(problemsOf(resolve({ ...SMTP_READY, SMTP_USER: 'u', SMTP_PASS: '' }))).toEqual([
        'SMTP_PASS is required when SMTP_USER is set'
      ])
    })
  })

  describe('keyNamespace', () => {
    const namespaceOf = (over: Partial<EmailEnv>): string | undefined => {
      const result = resolve({ ...SMTP_READY, ...over })
      return result.status === 'ready' ? result.keyNamespace : undefined
    }

    test('keyNamespace is the PUBLIC_RESTAPI_URL host', () => {
      expect(
        namespaceOf({
          PUBLIC_RESTAPI_URL: 'https://stageback.docs.plus',
          APP_URL: 'https://stage.docs.plus'
        })
      ).toBe('stageback.docs.plus')
    })

    test('keyNamespace falls back to the APP_URL host', () => {
      expect(namespaceOf({ PUBLIC_RESTAPI_URL: '', APP_URL: 'https://docs.acme.com/' })).toBe(
        'docs.acme.com'
      )
    })
  })
})

describe('resolveWebhookSecret', () => {
  // 32 base64 characters decode to 24 bytes, the Standard Webhooks floor.
  const SECRET_24 = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

  test.each([
    ['a whsec_ secret of 24 bytes', SECRET_24, SECRET_24],
    ['the same secret without the prefix', SECRET_24.slice(6), SECRET_24.slice(6)],
    ['a value padded with spaces', `  ${SECRET_24} `, SECRET_24]
  ])('%s is accepted', (_, raw, expected) => {
    expect(resolveWebhookSecret(raw)).toBe(expected)
  })

  test.each([
    ['unset', undefined],
    ['blank', '   '],
    ['18 bytes', 'whsec_plJ3nmyCDGBKInavdOK15jsl'],
    ['not base64', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2La!aSw'],
    ['broken padding', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaS']
  ])('%s is refused', (_, raw) => {
    expect(resolveWebhookSecret(raw)).toBeNull()
  })
})
