import nodemailer from 'nodemailer'

import { maskEmailsIn } from '../../maskEmail'
import type { ConnectionCheck, EmailErrorKind, EmailProvider, EmailProviderConfig } from './types'
import { EmailSendError } from './types'

type SmtpConfig = Extract<EmailProviderConfig, { name: 'smtp' }>

/**
 * nodemailer stamps EAUTH on a transient 454 too, so the response code decides
 * first. No response code means the connection failed, and time fixes that,
 * except for EAUTH: a refused login needs an operator.
 */
export function classifySmtpError(
  code: string | undefined,
  responseCode: number | undefined,
  response: string | undefined
): EmailErrorKind {
  if (responseCode !== undefined && responseCode >= 400 && responseCode < 500) return 'transient'
  if (response && /\b5\.1\.\d{1,3}\b/.test(response)) return 'permanent'
  if (responseCode !== undefined && responseCode >= 500) return 'operator'
  return code === 'EAUTH' ? 'operator' : 'transient'
}

// The code stays verbatim, because incident-email-broken matches nodemailer's EAUTH.
// No cause: nodemailer puts the rejected recipients on its error object.
const toSendError = (err: unknown): EmailSendError => {
  const e = err as { code?: unknown; responseCode?: unknown; response?: unknown; message?: unknown }
  const code = typeof e?.code === 'string' ? e.code : undefined
  const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : undefined
  return new EmailSendError(
    classifySmtpError(code, responseCode, typeof e?.response === 'string' ? e.response : undefined),
    code ?? 'unknown',
    maskEmailsIn(typeof e?.message === 'string' ? e.message : String(err)),
    { responseCode }
  )
}

export function createSmtpProvider(cfg: SmtpConfig): EmailProvider {
  // Nodemailer's own defaults are minutes long. These bound every connect and
  // every send. SMTP takes no AbortSignal, and a send must never race one: SMTP
  // has no idempotency key, so a race plus a retry sends twice.
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.auth ? { auth: cfg.auth } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10
  })

  return {
    name: 'smtp',

    async send(message) {
      try {
        const info = await transporter.sendMail({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo,
          headers: message.headers
        })
        return { messageId: info.messageId }
      } catch (err) {
        throw toSendError(err)
      }
    },

    async checkConnection(): Promise<ConnectionCheck> {
      try {
        await transporter.verify()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toSendError(err) }
      }
    },

    async close() {
      transporter.close()
    }
  }
}
