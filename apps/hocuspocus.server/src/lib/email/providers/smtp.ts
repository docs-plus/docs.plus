import nodemailer from 'nodemailer'

import type { ConnectionCheck, EmailProvider, EmailProviderConfig } from './types'
import { EmailSendError } from './types'

type SmtpConfig = Extract<EmailProviderConfig, { name: 'smtp' }>

// Every failure is transient for now, so BullMQ retries it. The code stays
// verbatim, because incident-email-broken matches nodemailer's EAUTH.
const toSendError = (err: unknown): EmailSendError => {
  const e = err as { code?: unknown; responseCode?: unknown; message?: unknown }
  return new EmailSendError(
    'transient',
    typeof e?.code === 'string' ? e.code : 'unknown',
    typeof e?.message === 'string' ? e.message : String(err),
    { cause: err, responseCode: typeof e?.responseCode === 'number' ? e.responseCode : undefined }
  )
}

export function createSmtpProvider(cfg: SmtpConfig): EmailProvider {
  // Nodemailer's own defaults are 2 minutes each. These bound every connect,
  // including the boot connection check. SMTP takes no AbortSignal, and a
  // send must never race one: SMTP has no idempotency key.
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.auth ? { auth: cfg.auth } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
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
        const { kind, code, message, responseCode } = toSendError(err)
        return { ok: false, kind, code, message, responseCode }
      }
    },

    async close() {
      transporter.close()
    }
  }
}
