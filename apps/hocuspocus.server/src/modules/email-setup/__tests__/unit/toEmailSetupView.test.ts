import { describe, expect, test } from 'bun:test'

import type { EmailConfig, EmailEnvFacts } from '../../../../config/email'
import { EmailSendError } from '../../../../lib/email/providers/types'
import { toEmailSetupView } from '../../domain/toEmailSetupView'
import type { EmailSetupExtras } from '../../types'

const RESEND_KEY = 're_SECRET_resend_key_value'
const SMTP_PASS = 'PASS_SECRET_smtp_value'

const READY: EmailConfig = {
  status: 'ready',
  from: 'Docs <notify@mail.docs.plus>',
  provider: { name: 'resend', apiKey: RESEND_KEY },
  keyNamespace: 'prodback.docs.plus'
}

const ALL_SET: EmailEnvFacts = {
  provider: 'resend',
  from: 'Docs <notify@mail.docs.plus>',
  smtpHost: null,
  smtpPort: 587,
  publicUrl: 'https://prodback.docs.plus',
  webhookSecret: 'set',
  set: { RESEND_API_KEY: true, SMTP_USER: true, SMTP_PASS: true, EMAIL_UNSUBSCRIBE_SECRET: true }
}

const NONE_SET: EmailEnvFacts = {
  provider: null,
  from: null,
  smtpHost: null,
  smtpPort: 587,
  publicUrl: null,
  webhookSecret: 'missing',
  set: {
    RESEND_API_KEY: false,
    SMTP_USER: false,
    SMTP_PASS: false,
    EMAIL_UNSUBSCRIBE_SECRET: false
  }
}

const EXTRAS: EmailSetupExtras = {
  connection: { ok: true },
  latestBounce: null,
  queue: { connected: true, pending: 0, dlqDepth: 0 }
}

describe('toEmailSetupView', () => {
  test('reads every set secret as set, and carries no secret value', () => {
    const smtpReady: EmailConfig = {
      status: 'ready',
      from: 'Docs <notify@acme.com>',
      provider: {
        name: 'smtp',
        host: 'smtp.acme.com',
        port: 465,
        secure: true,
        auth: { user: 'resend', pass: SMTP_PASS }
      },
      keyNamespace: 'acme.com'
    }

    for (const delivery of [READY, smtpReady]) {
      const view = toEmailSetupView(delivery, ALL_SET, EXTRAS)
      expect(Object.values(view.secrets)).toEqual(['set', 'set', 'set', 'set'])
      expect(view.envToAdd).toEqual([])
      const json = JSON.stringify(view)
      expect(json).not.toContain(RESEND_KEY)
      expect(json).not.toContain(SMTP_PASS)
    }
  })

  test('reads every unset secret as missing, and lists the lines to add', () => {
    const view = toEmailSetupView({ status: 'off' }, NONE_SET, EXTRAS)
    expect(Object.values(view.secrets)).toEqual(['missing', 'missing', 'missing', 'missing'])
    expect(view.envToAdd).toEqual([
      'EMAIL_PROVIDER=resend',
      'EMAIL_FROM=',
      'RESEND_API_KEY=',
      'RESEND_WEBHOOK_SECRET=',
      'EMAIL_UNSUBSCRIBE_SECRET=',
      'PUBLIC_RESTAPI_URL='
    ])
  })

  test('an SMTP host without EMAIL_PROVIDER names the problem and suggests smtp', () => {
    const view = toEmailSetupView(
      { status: 'invalid', problems: ['set EMAIL_PROVIDER=resend or smtp'] },
      { ...NONE_SET, smtpHost: 'smtp.acme.com' },
      EXTRAS
    )
    expect(view.problems).toEqual(['set EMAIL_PROVIDER=resend or smtp'])
    expect(view.envToAdd.slice(0, 2)).toEqual(['EMAIL_PROVIDER=smtp', 'EMAIL_FROM='])
  })

  test('masks the bounce address, drops the username and cuts the reason', () => {
    const view = toEmailSetupView(READY, ALL_SET, {
      ...EXTRAS,
      latestBounce: {
        email: 'jane.doe@example.com',
        bounce_type: 'hard',
        provider: 'resend',
        reason: `550 5.1.1 <jane.doe@example.com> mailbox unavailable ${'x'.repeat(200)}`,
        username: 'janedoe',
        bounced_at: '2026-10-09T08:00:00.000Z'
      }
    })
    expect(view.latestBounce.state).toBe('found')
    if (view.latestBounce.state !== 'found') return
    expect(view.latestBounce.email).toBe('j***@example.com')
    expect(view.latestBounce.reason?.length).toBeLessThanOrEqual(80)
    const json = JSON.stringify(view)
    expect(json).not.toContain('jane.doe@')
    expect(json).not.toContain('janedoe')
  })

  test('a failed check keeps the kind and code, never the provider text', () => {
    const view = toEmailSetupView(READY, ALL_SET, {
      ...EXTRAS,
      connection: {
        ok: false,
        error: new EmailSendError('operator', 'EAUTH', 'auth failed for resend at smtp.acme.com')
      }
    })
    expect(view.connection).toEqual({ state: 'failed', kind: 'operator', code: 'EAUTH' })
  })
})
