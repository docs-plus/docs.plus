import type { SupabaseClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'

import type { EmailConfig, EmailEnvFacts, EmailSecretName } from '../../config/email'
import type {
  ConnectionCheck,
  EmailErrorKind,
  EmailMessage,
  EmailProvider,
  SentEmail
} from '../../lib/email/providers/types'
import type { BounceType } from '../../types/email.types'
import type { RedisClient } from '../../types/redis.types'

/** One row of the `get_email_bounces` RPC. */
export interface EmailBounceRow {
  email: string
  bounce_type: BounceType
  provider: string | null
  reason: string | null
  username?: string | null
  bounced_at: string
}

export interface EmailSetupExtras {
  /** `skipped` when the config is not ready, so no provider exists. */
  connection: ConnectionCheck | 'timeout' | 'skipped'
  latestBounce: EmailBounceRow | null | 'unavailable'
  queue: { connected: boolean; pending: number; dlqDepth: number | null }
}

export type ConnectionView =
  | { state: 'ok'; note?: 'send_only_key' }
  | { state: 'failed'; kind: EmailErrorKind; code: string }
  | { state: 'timeout' }
  | { state: 'skipped' }

export type BounceView =
  | { state: 'none' }
  | { state: 'unavailable' }
  | {
      state: 'found'
      email: string
      bounceType: BounceType
      provider: string | null
      reason: string | null
      bouncedAt: string
    }

/** The whole `GET /api/admin/email/setup` payload. It holds no secret value. */
export interface EmailSetupView {
  status: EmailConfig['status']
  problems: string[]
  provider: string | null
  from: string | null
  namespace: string | null
  smtp: { host: string | null; port: number }
  publicUrl: string | null
  secrets: Record<EmailSecretName, 'set' | 'missing'>
  webhook: { secret: EmailEnvFacts['webhookSecretState']; url: string | null }
  connection: ConnectionView
  latestBounce: BounceView
  queue: EmailSetupExtras['queue']
  /** `.env` lines to add, blank where the value is a secret or unknown. */
  envToAdd: string[]
}

export type TestSendResult =
  | { sent: true; messageId: string; to: string }
  | { sent: false; kind: EmailErrorKind; code: string }

export type TestSendBudget = (userId: string) => Promise<'allowed' | 'limited' | 'unavailable'>

export interface InitDeps {
  delivery: EmailConfig
  facts: EmailEnvFacts
  /** The admin guard. The module applies it itself, so mount order cannot open it. */
  adminAuth: MiddlewareHandler
  getEmailProvider: () => EmailProvider | null
  deliverEmail: (
    message: EmailMessage,
    options: { idempotencyKey: string; jobId: string }
  ) => Promise<SentEmail>
  getEmailQueueHealth: () => Promise<{ available: boolean; waiting: number; delayed: number }>
  getEmailDlqDepth: () => Promise<number | null>
  supabase: SupabaseClient | null
  redis: RedisClient | null
  logger: Logger
}
