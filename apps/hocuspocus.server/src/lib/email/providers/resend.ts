import type { ConnectionCheck, EmailProvider, EmailProviderConfig } from './types'
import { EmailSendError } from './types'

type ResendConfig = Extract<EmailProviderConfig, { name: 'resend' }>

const RESEND_API_URL = 'https://api.resend.com'

interface ResendErrorBody {
  name?: string
  message?: string
}

const readErrorBody = async (response: Response): Promise<ResendErrorBody> =>
  ((await response.json().catch(() => ({}))) as ResendErrorBody) ?? {}

// Every failure is transient for now, so BullMQ retries it. `code` is Resend's
// own error name, verbatim, so a later map can key on it.
const httpError = async (response: Response): Promise<EmailSendError> => {
  const body = await readErrorBody(response)
  return new EmailSendError(
    'transient',
    body.name ?? `http_${response.status}`,
    body.message ?? `HTTP ${response.status}`,
    { responseCode: response.status }
  )
}

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
            tags: message.tags
              ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
              : undefined
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
        const { kind, code, message, responseCode } = failure
        return { ok: false, kind, code, message, responseCode }
      } catch (err) {
        const { kind, code, message } = networkError(err)
        return { ok: false, kind, code, message }
      }
    },

    async close() {}
  }
}
