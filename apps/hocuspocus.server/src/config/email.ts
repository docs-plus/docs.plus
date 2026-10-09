// Type import only: env.schema validates at import and may exit the process.
import type { Env } from './env.schema'

export type EmailProviderConfig =
  | { name: 'resend'; apiKey: string }
  | {
      name: 'smtp'
      host: string
      port: number
      secure: boolean
      auth?: { user: string; pass: string }
    }

export type EmailProviderName = EmailProviderConfig['name']

export type EmailConfig =
  | { status: 'ready'; from: string; provider: EmailProviderConfig; keyNamespace: string }
  | { status: 'off' }
  | { status: 'invalid'; problems: string[] }

type EmailEnv = Pick<
  Env,
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'RESEND_API_KEY'
  | 'SENDGRID_API_KEY'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_USER'
  | 'SMTP_PASS'
  | 'SMTP_SECURE'
  | 'PUBLIC_RESTAPI_URL'
  | 'APP_URL'
>

// Compose and dotenv both turn a blank line into '', which is as absent as undefined.
const nonBlank = (raw: string | undefined): string | undefined => raw?.trim() || undefined

const hostOf = (raw: string | undefined): string | undefined => {
  const url = nonBlank(raw)
  if (!url) return undefined
  try {
    return new URL(url).host || undefined
  } catch {
    return undefined
  }
}

const WEBHOOK_SECRET_MIN_BYTES = 24
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/**
 * Pure. A Standard Webhooks secret is base64 behind an optional `whsec_` prefix.
 * A value that is not strict base64, or decodes to under 24 bytes, is `null`:
 * the webhook route then stays unmounted, and product mail is never held for it.
 */
export function resolveWebhookSecret(raw: string | undefined): string | null {
  const value = nonBlank(raw)
  if (!value) return null
  const encoded = value.startsWith('whsec_') ? value.slice('whsec_'.length) : value
  if (!BASE64.test(encoded)) return null
  return atob(encoded).length >= WEBHOOK_SECRET_MIN_BYTES ? value : null
}

/** The keys the setup page shows only as set or missing. SMTP_USER pairs with SMTP_PASS. */
export type EmailSecretName =
  'RESEND_API_KEY' | 'SMTP_USER' | 'SMTP_PASS' | 'EMAIL_UNSUBSCRIBE_SECRET'

/** Presence only, plus values that are not secret. No secret value enters this object. */
export interface EmailEnvFacts {
  /** `EMAIL_PROVIDER` as written, so the setup page can name a wrong value. */
  provider: string | null
  from: string | null
  smtpHost: string | null
  smtpPort: number
  publicUrl: string | null
  webhookSecretState: 'set' | 'missing' | 'invalid'
  set: Record<EmailSecretName, boolean>
}

/** Pure. Feeds the admin Email setup page, which must never see a secret value. */
export function describeEmailEnv(
  env: EmailEnv & Pick<Env, 'RESEND_WEBHOOK_SECRET' | 'EMAIL_UNSUBSCRIBE_SECRET'>
): EmailEnvFacts {
  const webhookRaw = nonBlank(env.RESEND_WEBHOOK_SECRET)
  return {
    provider: nonBlank(env.EMAIL_PROVIDER) ?? null,
    from: nonBlank(env.EMAIL_FROM) ?? null,
    smtpHost: nonBlank(env.SMTP_HOST) ?? null,
    smtpPort: env.SMTP_PORT,
    publicUrl: nonBlank(env.PUBLIC_RESTAPI_URL) ?? null,
    webhookSecretState: !webhookRaw
      ? 'missing'
      : resolveWebhookSecret(webhookRaw)
        ? 'set'
        : 'invalid',
    set: {
      RESEND_API_KEY: Boolean(nonBlank(env.RESEND_API_KEY)),
      SMTP_USER: Boolean(nonBlank(env.SMTP_USER)),
      SMTP_PASS: Boolean(nonBlank(env.SMTP_PASS)),
      EMAIL_UNSUBSCRIBE_SECRET: Boolean(nonBlank(env.EMAIL_UNSUBSCRIBE_SECRET))
    }
  }
}

/**
 * Pure and never throws. Only `ready` sends; `off` settles mail as skipped,
 * and `invalid` holds it. A provider key without EMAIL_PROVIDER is `invalid`,
 * so a leftover key can never pick the sender.
 */
export function resolveEmailConfig(env: EmailEnv): EmailConfig {
  const rawProvider = nonBlank(env.EMAIL_PROVIDER)
  const provider = rawProvider?.toLowerCase()

  if (!provider) {
    const leftover = [env.RESEND_API_KEY, env.SMTP_HOST, env.SENDGRID_API_KEY].some(nonBlank)
    return leftover
      ? { status: 'invalid', problems: ['set EMAIL_PROVIDER=resend or smtp'] }
      : { status: 'off' }
  }
  if (provider === 'sendgrid') {
    return {
      status: 'invalid',
      problems: [
        'EMAIL_PROVIDER=sendgrid was removed; set EMAIL_PROVIDER=smtp and use the SendGrid SMTP relay'
      ]
    }
  }
  if (provider !== 'resend' && provider !== 'smtp') {
    return {
      status: 'invalid',
      problems: [`EMAIL_PROVIDER=${rawProvider} is not supported; use resend or smtp`]
    }
  }

  const problems: string[] = []
  const from = nonBlank(env.EMAIL_FROM)
  if (!from) problems.push('EMAIL_FROM is required')

  let providerConfig: EmailProviderConfig | undefined
  if (provider === 'resend') {
    const apiKey = nonBlank(env.RESEND_API_KEY)
    if (!apiKey) problems.push('RESEND_API_KEY is required for EMAIL_PROVIDER=resend')
    else providerConfig = { name: 'resend', apiKey }
  } else {
    const host = nonBlank(env.SMTP_HOST)
    if (!host) problems.push('SMTP_HOST is required for EMAIL_PROVIDER=smtp')

    const user = nonBlank(env.SMTP_USER)
    const pass = nonBlank(env.SMTP_PASS)
    if (user && !pass) problems.push('SMTP_PASS is required when SMTP_USER is set')
    if (pass && !user) problems.push('SMTP_USER is required when SMTP_PASS is set')

    const secureText = nonBlank(env.SMTP_SECURE)?.toLowerCase()
    if (secureText && secureText !== 'true' && secureText !== 'false') {
      problems.push('SMTP_SECURE must be true or false')
    }
    const secure = secureText ? secureText === 'true' : env.SMTP_PORT === 465

    if (host) {
      providerConfig = {
        name: 'smtp',
        host,
        port: env.SMTP_PORT,
        secure,
        ...(user && pass ? { auth: { user, pass } } : {})
      }
    }
  }

  if (problems.length > 0 || !from || !providerConfig) return { status: 'invalid', problems }

  return {
    status: 'ready',
    from,
    provider: providerConfig,
    // Staging and prod never share provider idempotency keys.
    keyNamespace: hostOf(env.PUBLIC_RESTAPI_URL) ?? hostOf(env.APP_URL) ?? 'docs.plus'
  }
}
