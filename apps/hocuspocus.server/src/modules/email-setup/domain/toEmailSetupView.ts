import type { EmailConfig, EmailEnvFacts, EmailSecretName } from '../../../config/email'
import { maskEmail, maskEmailsIn } from '../../../lib/maskEmail'
import type {
  BounceView,
  ConnectionView,
  EmailBounceRow,
  EmailSetupExtras,
  EmailSetupView
} from '../types'

const REASON_MAX_CHARS = 80

const toConnectionView = (check: EmailSetupExtras['connection']): ConnectionView => {
  if (check === 'timeout' || check === 'skipped') return { state: check }
  if (check.ok) return check.note ? { state: 'ok', note: check.note } : { state: 'ok' }
  // Kind and code only: provider text can name a host or quote an account.
  return { state: 'failed', kind: check.error.kind, code: check.error.code }
}

const cutReason = (reason: string | null): string | null => {
  if (!reason) return null
  const masked = maskEmailsIn(reason)
  return masked.length > REASON_MAX_CHARS ? `${masked.slice(0, REASON_MAX_CHARS - 1)}…` : masked
}

// Field by field, so the username the RPC joins in never reaches the page.
const toBounceView = (row: EmailBounceRow | null | 'unavailable'): BounceView => {
  if (row === 'unavailable') return { state: 'unavailable' }
  if (!row) return { state: 'none' }
  return {
    state: 'found',
    email: maskEmail(row.email),
    bounceType: row.bounce_type,
    provider: row.provider,
    reason: cutReason(row.reason),
    bouncedAt: row.bounced_at
  }
}

/** Without EMAIL_PROVIDER, an SMTP host is the clearer hint; Resend is the house default. */
const targetProvider = (facts: EmailEnvFacts): 'resend' | 'smtp' => {
  const named = facts.provider?.toLowerCase()
  if (named === 'resend' || named === 'smtp') return named
  return facts.smtpHost ? 'smtp' : 'resend'
}

const envLinesToAdd = (facts: EmailEnvFacts): string[] => {
  const target = targetProvider(facts)
  const lines: string[] = []
  if (facts.provider?.toLowerCase() !== target) lines.push(`EMAIL_PROVIDER=${target}`)
  if (!facts.from) lines.push('EMAIL_FROM=')
  if (target === 'resend') {
    if (!facts.set.RESEND_API_KEY) lines.push('RESEND_API_KEY=')
    if (facts.webhookSecret !== 'set') lines.push('RESEND_WEBHOOK_SECRET=')
  } else {
    if (!facts.smtpHost) lines.push('SMTP_HOST=')
    if (facts.set.SMTP_USER && !facts.set.SMTP_PASS) lines.push('SMTP_PASS=')
    if (facts.set.SMTP_PASS && !facts.set.SMTP_USER) lines.push('SMTP_USER=')
  }
  if (!facts.set.EMAIL_UNSUBSCRIBE_SECRET) lines.push('EMAIL_UNSUBSCRIBE_SECRET=')
  if (!facts.publicUrl) lines.push('PUBLIC_RESTAPI_URL=')
  return lines
}

/**
 * The only code that builds the Email setup page data. A ready `delivery`
 * holds the provider secret, so every output field is copied by name.
 */
export function toEmailSetupView(
  delivery: EmailConfig,
  facts: EmailEnvFacts,
  extras: EmailSetupExtras
): EmailSetupView {
  const secrets = Object.fromEntries(
    Object.entries(facts.set).map(([name, isSet]) => [name, isSet ? 'set' : 'missing'])
  ) as Record<EmailSecretName, 'set' | 'missing'>

  return {
    status: delivery.status,
    problems: delivery.status === 'invalid' ? delivery.problems : [],
    provider: delivery.status === 'ready' ? delivery.provider.name : facts.provider,
    from: facts.from,
    namespace: delivery.status === 'ready' ? delivery.keyNamespace : null,
    smtp: { host: facts.smtpHost, port: facts.smtpPort },
    publicUrl: facts.publicUrl,
    secrets,
    webhook: {
      secret: facts.webhookSecret,
      url: facts.publicUrl
        ? `${facts.publicUrl.replace(/\/+$/, '')}/api/email/webhooks/resend`
        : null
    },
    connection: toConnectionView(extras.connection),
    latestBounce: toBounceView(extras.latestBounce),
    queue: extras.queue,
    envToAdd: envLinesToAdd(facts)
  }
}
