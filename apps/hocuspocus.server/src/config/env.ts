import { env } from './env.schema'

export { env }

export const config = {
  app: {
    port: env.APP_PORT,
    name: env.APP_NAME,
    env: env.NODE_ENV,
    // Compose interpolates an unset var to `''`, which is as absent as undefined.
    publicUrl: env.PUBLIC_RESTAPI_URL || null
  },

  hocuspocus: {
    port: env.HOCUSPOCUS_PORT,
    internalHttpPort: env.HOCUSPOCUS_INTERNAL_HTTP_PORT,
    internalHttpHost: env.HOCUSPOCUS_INTERNAL_HTTP_HOST,
    internalUrl: env.HOCUSPOCUS_INTERNAL_URL,
    logger: {
      enabled: env.HOCUSPOCUS_LOGGER,
      onConnect: env.HOCUSPOCUS_LOGGER_ON_CONNECT,
      onDisconnect: env.HOCUSPOCUS_LOGGER_ON_DISCONNECT,
      onLoadDocument: env.HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT,
      onChange: env.HOCUSPOCUS_LOGGER_ON_CHANGE,
      onUpgrade: env.HOCUSPOCUS_LOGGER_ON_UPGRADE,
      onRequest: env.HOCUSPOCUS_LOGGER_ON_REQUEST,
      onListen: env.HOCUSPOCUS_LOGGER_ON_LISTEN,
      onDestroy: env.HOCUSPOCUS_LOGGER_ON_DESTROY,
      onConfigure: env.HOCUSPOCUS_LOGGER_ON_CONFIGURE
    },
    throttle: {
      enabled: env.HOCUSPOCUS_THROTTLE,
      attempts: env.HOCUSPOCUS_THROTTLE_ATTEMPTS,
      banTime: env.HOCUSPOCUS_THROTTLE_BANTIME
    }
  },

  database: {
    url: env.DATABASE_URL
  },

  redis: {
    enabled: env.REDIS,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    tls: env.REDIS_TLS,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT,
    commandTimeout: env.REDIS_COMMAND_TIMEOUT,
    keepAlive: env.REDIS_KEEPALIVE,
    maxRetries: env.REDIS_MAX_RETRIES
  },

  storage: {
    local: {
      enabled: env.PERSIST_TO_LOCAL_STORAGE,
      path: env.LOCAL_STORAGE_PATH
    },
    s3: {
      endpoint: env.DO_STORAGE_ENDPOINT,
      region: env.DO_STORAGE_REGION,
      bucket: env.DO_STORAGE_BUCKET,
      accessKeyId: env.DO_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.DO_STORAGE_SECRET_ACCESS_KEY,
      maxFileSize: env.DO_STORAGE_MAX_FILE_SIZE
    }
  },

  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  },

  security: {
    allowedOrigins: env.ALLOWED_ORIGINS,
    rateLimitMax: env.RATE_LIMIT_MAX
  },

  email: {
    fromEmail: env.EMAIL_FROM || env.SMTP_USER || 'noreply@docs.plus',
    fromName: env.SMTP_FROM_NAME,
    notificationEmails: env.NEW_DOCUMENT_NOTIFICATION_EMAILS.filter((email) => email.includes('@')),
    appUrl: env.APP_URL,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    gateway: {
      workerConcurrency: env.EMAIL_WORKER_CONCURRENCY,
      rateLimitMax: env.EMAIL_RATE_LIMIT_MAX,
      rateLimitDuration: env.EMAIL_RATE_LIMIT_DURATION
    }
  },

  push: {
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT
    },
    gateway: {
      workerConcurrency: env.PUSH_WORKER_CONCURRENCY,
      rateLimitMax: env.PUSH_RATE_LIMIT_MAX,
      rateLimitDuration: env.PUSH_RATE_LIMIT_DURATION
    }
  },

  bullmq: {
    concurrency: env.BULLMQ_CONCURRENCY,
    rateLimitMax: env.BULLMQ_RATE_LIMIT_MAX,
    rateLimitDuration: env.BULLMQ_RATE_LIMIT_DURATION
  },

  dbPool: {
    size: env.DB_POOL_SIZE,
    idleTimeout: env.DB_IDLE_TIMEOUT,
    connectTimeout: env.DB_CONNECT_TIMEOUT,
    statementTimeout: env.DB_STATEMENT_TIMEOUT,
    queryTimeout: env.DB_QUERY_TIMEOUT
  },

  worker: {
    errorThreshold: env.WORKER_ERROR_THRESHOLD,
    errorWindowMs: env.WORKER_ERROR_WINDOW_MS,
    shutdownTimeoutMs: env.WORKER_SHUTDOWN_TIMEOUT_MS,
    idempotencyCleanupIntervalMs: env.IDEMPOTENCY_CLEANUP_INTERVAL_MS,
    autosaveRetentionDays: env.DOC_AUTOSAVE_RETENTION_DAYS,
    deleteRetentionDays: env.DOC_DELETE_RETENTION_DAYS,
    healthPort: env.WORKER_HEALTH_PORT
  },

  logging: {
    level: env.LOG_LEVEL
  }
} as const

export type Config = typeof config

export default config
