/**
 * Environment Variable Validation Schema
 *
 * Validates all environment variables at startup using Zod.
 * Fails fast if required variables are missing or invalid.
 */

import { z } from 'zod'

// Helper for boolean env vars (accepts 'true'/'false' strings)
const booleanString = z
  .string()
  .optional()
  .default('false')
  .transform((val) => val === 'true')

// Helper for numeric env vars
const numericString = (defaultValue: string) =>
  z
    .string()
    .regex(/^\d+$/, 'Must be a number')
    .default(defaultValue)
    .transform((val) => parseInt(val, 10))

// Helper for comma-separated lists
const commaSeparatedList = z
  .string()
  .optional()
  .default('')
  .transform((val) =>
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )

// =============================================================================
// Environment Schema
// =============================================================================

export const envSchema = z.object({
  // -------------------------------------------------------------------------
  // Core Application
  // -------------------------------------------------------------------------
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('hocuspocus'),
  APP_PORT: numericString('4000'),
  HOCUSPOCUS_PORT: numericString('4001'),
  WORKER_HEALTH_PORT: numericString('4002'),

  // -------------------------------------------------------------------------
  // Database (Required)
  // -------------------------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // -------------------------------------------------------------------------
  // Redis (Optional - features degrade gracefully without it)
  // -------------------------------------------------------------------------
  REDIS: booleanString,
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: numericString('6379'),
  REDIS_TLS: booleanString,
  REDIS_CONNECT_TIMEOUT: numericString('30000'),
  REDIS_COMMAND_TIMEOUT: numericString('60000'),
  REDIS_KEEPALIVE: numericString('30000'),
  REDIS_MAX_RETRIES: numericString('10'),

  // -------------------------------------------------------------------------
  // Supabase (Required for auth and realtime features)
  // -------------------------------------------------------------------------
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // -------------------------------------------------------------------------
  // Security
  // -------------------------------------------------------------------------
  JWT_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: commaSeparatedList,
  RATE_LIMIT_MAX: numericString('100'),

  // -------------------------------------------------------------------------
  // Hocuspocus Logger
  // -------------------------------------------------------------------------
  HOCUSPOCUS_LOGGER: booleanString,
  HOCUSPOCUS_LOGGER_ON_CONNECT: booleanString,
  HOCUSPOCUS_LOGGER_ON_DISCONNECT: booleanString,
  HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT: booleanString,
  HOCUSPOCUS_LOGGER_ON_CHANGE: booleanString,
  HOCUSPOCUS_LOGGER_ON_UPGRADE: booleanString,
  HOCUSPOCUS_LOGGER_ON_REQUEST: booleanString,
  HOCUSPOCUS_LOGGER_ON_LISTEN: booleanString,
  HOCUSPOCUS_LOGGER_ON_DESTROY: booleanString,
  HOCUSPOCUS_LOGGER_ON_CONFIGURE: booleanString,

  // -------------------------------------------------------------------------
  // Hocuspocus Throttle
  // -------------------------------------------------------------------------
  HOCUSPOCUS_THROTTLE: booleanString,
  HOCUSPOCUS_THROTTLE_ATTEMPTS: numericString('10'),
  HOCUSPOCUS_THROTTLE_BANTIME: numericString('60000'),

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------
  PERSIST_TO_LOCAL_STORAGE: booleanString,
  LOCAL_STORAGE_PATH: z.string().default('./temp'),
  DO_STORAGE_ENDPOINT: z.string().optional().default(''),
  DO_STORAGE_REGION: z.string().default('us-east-1'),
  DO_STORAGE_BUCKET: z.string().optional().default(''),
  DO_STORAGE_ACCESS_KEY_ID: z.string().optional().default(''),
  DO_STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(''),
  DO_STORAGE_MAX_FILE_SIZE: numericString('4194304'),

  // -------------------------------------------------------------------------
  // Email (SMTP)
  // -------------------------------------------------------------------------
  EMAIL_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('docs.plus'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: numericString('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: booleanString,
  NEW_DOCUMENT_NOTIFICATION_EMAILS: commaSeparatedList,
  APP_URL: z.string().default('https://docs.plus'),

  // Email Gateway
  EMAIL_WORKER_CONCURRENCY: numericString('3'),
  EMAIL_RATE_LIMIT_MAX: numericString('50'),
  EMAIL_RATE_LIMIT_DURATION: numericString('60000'),

  // -------------------------------------------------------------------------
  // Push Notifications (VAPID)
  // -------------------------------------------------------------------------
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:support@docs.plus'),

  // Push Gateway
  PUSH_WORKER_CONCURRENCY: numericString('5'),
  PUSH_RATE_LIMIT_MAX: numericString('100'),
  PUSH_RATE_LIMIT_DURATION: numericString('60000'),

  // -------------------------------------------------------------------------
  // BullMQ
  // -------------------------------------------------------------------------
  BULLMQ_CONCURRENCY: numericString('5'),
  BULLMQ_RATE_LIMIT_MAX: numericString('300'),
  BULLMQ_RATE_LIMIT_DURATION: numericString('1000'),

  // -------------------------------------------------------------------------
  // Database Pool
  // -------------------------------------------------------------------------
  DB_POOL_SIZE: numericString('10'),
  DB_IDLE_TIMEOUT: numericString('300000'),
  DB_CONNECT_TIMEOUT: numericString('10000'),
  DB_STATEMENT_TIMEOUT: numericString('60000'),
  DB_QUERY_TIMEOUT: numericString('60000'),

  // -------------------------------------------------------------------------
  // Worker
  // -------------------------------------------------------------------------
  WORKER_ERROR_THRESHOLD: numericString('10'),
  WORKER_ERROR_WINDOW_MS: numericString('60000'),
  WORKER_SHUTDOWN_TIMEOUT_MS: numericString('120000'),
  IDEMPOTENCY_CLEANUP_INTERVAL_MS: numericString('3600000'),

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
})

// =============================================================================
// Type Export
// =============================================================================

export type Env = z.infer<typeof envSchema>

// =============================================================================
// Validated Environment (fails fast on invalid config)
// =============================================================================

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment configuration:')
    console.error(result.error.format())
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()
