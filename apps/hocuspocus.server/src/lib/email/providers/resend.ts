import { maskEmailsIn } from '../../maskEmail'
import type {
  ConnectionCheck,
  EmailErrorKind,
  EmailMessage,
  EmailProvider,
  EmailProviderConfig
} from './types'
import { EmailSendError } from './types'

type ResendConfig = Extract<EmailProviderConfig, { name: 'resend' }>

const RESEND_API_URL = 'https://api.resend.com'

const TRANSIENT_NAMES = new Set([
  'rate_limit_exceeded',
  'concurrent_idempotent_requests',
  'application_error',
  'internal_server_error'
])

const OPERATOR_NAMES = new Set([
  'missing_api_key',
  'invalid_api_key',
  'restricted_api_key',
  'invalid_from_address',
  'invalid_access',
  'invalid_region',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'invalid_idempotent_request',
  'invalid_idempotency_key',
  'missing_required_field',
  'invalid_parameter',
  'invalid_attachment',
  'not_found',
  'method_not_allowed'
])

// Resend quotes field names in backticks, as in "Invalid `to` field".
const MESSAGE_FIELD = /`(to|subject|html|text)`/

/**
 * Keyed by the Resend error name; an unknown name falls back to the status.
 * A quota error arrives as 429 but needs an operator, so the name decides first.
 */
export function classifyResendError(
  name: string | undefined,
  status: number,
  message: string
): EmailErrorKind {
  if (name && TRANSIENT_NAMES.has(name)) return 'transient'
  if (name === 'security_error') return 'permanent'
  if (name === 'validation_error') {
    return status === 422 && MESSAGE_FIELD.test(message) ? 'permanent' : 'operator'
  }
  if (name && OPERATOR_NAMES.has(name)) return 'operator'
  return status >= 500 || status === 429 ? 'transient' : 'operator'
}

/** Resend accepts only `[A-Za-z0-9_-]` in a tag value. The webhook compares `ns` in this form. */
export const resendTagValue = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)

const resendTags = (tags: EmailMessage['tags']) =>
  tags
    ? Object.entries(tags).map(([name, value]) => ({ name, value: resendTagValue(value) }))
    : undefined

const httpError = async (response: Response): Promise<EmailSendError> => {
  const body = ((await response.json().catch(() => null)) ?? {}) as {
    name?: string
    message?: string
  }
  const message = maskEmailsIn(body.message ?? `HTTP ${response.status}`)
  return new EmailSendError(
    classifyResendError(body.name, response.status, message),
    body.name ?? `http_${response.status}`,
    message,
    { responseCode: response.status }
  )
}

// A network error or the caller's deadline: time fixes both.
const networkError = (err: unknown): EmailSendError =>
  new EmailSendError(
    'transient',
    err instanceof Error ? err.name : 'unknown',
    err instanceof Error ? err.message : String(err),
    { cause: err }
  )

export function createResendProvider(cfg: ResendConfig): EmailProvider {
  const authorization = `Bearer ${cfg.apiKey}`

  return {
    name: 'resend',

    async send(message, { signal, idempotencyKey }) {
      try {
        const response = await fetch(`${RESEND_API_URL}/emails`, {
          method: 'POST',
          signal,
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            reply_to: message.replyTo,
            headers: message.headers,
            tags: resendTags(message.tags)
          })
        })
        if (!response.ok) throw await httpError(response)
        const { id } = (await response.json()) as { id: string }
        return { messageId: id }
      } catch (err) {
        throw err instanceof EmailSendError ? err : networkError(err)
      }
    },

    async checkConnection({ signal }): Promise<ConnectionCheck> {
      try {
        const response = await fetch(`${RESEND_API_URL}/domains`, {
          headers: { Authorization: authorization },
          signal
        })
        if (response.ok) return { ok: true }
        const failure = await httpError(response)
        // A send-only key cannot list domains, but it is valid for sending.
        if (response.status === 401 && failure.code === 'restricted_api_key') {
          return { ok: true, note: 'send_only_key' }
        }
        return { ok: false, error: failure }
      } catch (err) {
        return { ok: false, error: networkError(err) }
      }
    },

    async close() {}
  }
}
