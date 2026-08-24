import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

const baseLevel = (process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')).toLowerCase()

const validLevels = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
const envLevel = (value: string | undefined, fallback: string) => {
  const lvl = (value || '').toLowerCase()
  return validLevels.has(lvl) ? (lvl as pino.LevelWithSilent) : (fallback as pino.LevelWithSilent)
}

export const logger = pino({
  level: baseLevel,

  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false
        }
      }
    : undefined,

  base: {
    env: process.env.NODE_ENV,
    app: 'hocuspocus-server'
  },

  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },

  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'accessToken',
      'refreshToken'
    ],
    censor: '[REDACTED]'
  }
})

/** Every child level is env-overridable; the envLevel(...) second arg is its default. */

export const httpLogger = logger.child(
  { module: 'http' },
  { level: envLevel(process.env.HTTP_LOG_LEVEL, baseLevel) }
)

export const dbLogger = logger.child(
  { module: 'database' },
  { level: envLevel(process.env.DB_LOG_LEVEL, baseLevel) }
)

export const redisLogger = logger.child(
  { module: 'redis' },
  { level: envLevel(process.env.REDIS_LOG_LEVEL, 'error') } // default: only errors
)

export const queueLogger = logger.child(
  { module: 'queue' },
  { level: envLevel(process.env.QUEUE_LOG_LEVEL, baseLevel) }
)

export const restApiLogger = logger.child(
  { service: 'rest-api' },
  { level: envLevel(process.env.REST_LOG_LEVEL, 'error') } // default: only errors
)

export const wsLogger = logger.child(
  { service: 'websocket' },
  { level: envLevel(process.env.WS_LOG_LEVEL, baseLevel) }
)

export const workerLogger = logger.child(
  { service: 'worker' },
  { level: envLevel(process.env.WORKER_LOG_LEVEL, baseLevel) }
)

export const documentsControllerLogger = logger.child(
  { module: 'documents-controller' },
  { level: envLevel(process.env.DOCUMENTS_CONTROLLER_LOG_LEVEL, baseLevel) }
)

export const documentsServiceLogger = logger.child(
  { module: 'documents-service' },
  { level: envLevel(process.env.DOCUMENTS_SERVICE_LOG_LEVEL, baseLevel) }
)

export const mediaServiceLogger = logger.child(
  { module: 'media-service' },
  { level: envLevel(process.env.MEDIA_SERVICE_LOG_LEVEL, baseLevel) }
)

export const conversionLogger = logger.child(
  { module: 'document-conversion' },
  { level: envLevel(process.env.CONVERSION_LOG_LEVEL, baseLevel) }
)

export const storageLocalLogger = logger.child(
  { module: 'storage-local' },
  { level: envLevel(process.env.STORAGE_LOCAL_LOG_LEVEL, baseLevel) }
)

export const storageS3Logger = logger.child(
  { module: 'storage-s3' },
  { level: envLevel(process.env.STORAGE_S3_LOG_LEVEL, baseLevel) }
)

export const jwtLogger = logger.child(
  { module: 'jwt' },
  { level: envLevel(process.env.JWT_LOG_LEVEL, baseLevel) }
)

export const emailLogger = logger.child(
  { module: 'email' },
  { level: envLevel(process.env.EMAIL_LOG_LEVEL, baseLevel) }
)

export const pushLogger = logger.child(
  { module: 'push' },
  { level: envLevel(process.env.PUSH_LOG_LEVEL, baseLevel) }
)

export const adminLogger = logger.child(
  { module: 'admin' },
  { level: envLevel(process.env.ADMIN_LOG_LEVEL, baseLevel) }
)
