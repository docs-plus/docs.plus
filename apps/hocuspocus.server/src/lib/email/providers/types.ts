import type { EmailProviderName } from '../../../config/email'

export type { EmailProviderConfig, EmailProviderName } from '../../../config/email'

/** What to send. No attachments, cc or bcc: no sender needs them yet. */
export interface EmailMessage {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  headers?: Record<string, string>
  tags?: Record<string, string>
}

export interface SendOptions {
  signal: AbortSignal
  idempotencyKey: string
}

export interface SentEmail {
  /** Opaque. Resend: the API email id. SMTP: the Message-ID header nodemailer wrote. */
  messageId: string
}

export type ConnectionCheck =
  | { ok: true; note?: 'send_only_key' }
  | { ok: false; kind: EmailErrorKind; code: string; message: string; responseCode?: number }

export interface EmailProvider {
  readonly name: EmailProviderName
  /**
   * Throws EmailSendError on any failure. An adapter that cannot cancel
   * ignores `signal` and relies on its own transport timeouts.
   */
  send(message: EmailMessage, options: SendOptions): Promise<SentEmail>
  /** Never throws: a failure comes back as `ok: false`. */
  checkConnection(options: { signal: AbortSignal }): Promise<ConnectionCheck>
  close(): Promise<void>
}

/** What makes the send succeed: time, nothing, or an operator. */
export type EmailErrorKind = 'transient' | 'permanent' | 'operator'

/**
 * `kind`, `code` and `responseCode` are own properties, so the pino err
 * serializer emits them and `incident-email-broken` keeps reading err_code.
 */
export class EmailSendError extends Error {
  readonly responseCode?: number
  constructor(
    readonly kind: EmailErrorKind,
    readonly code: string,
    message: string,
    options?: ErrorOptions & { responseCode?: number }
  ) {
    super(message, options)
    this.name = 'EmailSendError'
    this.responseCode = options?.responseCode
  }
}
