// Bun automatically loads .env files based on NODE_ENV
// Loads: .env, .env.local, .env.{NODE_ENV}, .env.{NODE_ENV}.local
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

export const config = {
  // Server
  app: {
    port: parseInt(process.env.APP_PORT || '3001', 10),
    name: process.env.APP_NAME || 'hocuspocus',
    env: process.env.NODE_ENV || 'development'
  },

  // Hocuspocus
  hocuspocus: {
    port: parseInt(process.env.HOCUSPOCUS_PORT || '3002', 10),
    logger: {
      enabled: process.env.HOCUSPOCUS_LOGGER === 'true',
      onConnect: process.env.HOCUSPOCUS_LOGGER_ON_CONNECT === 'true',
      onDisconnect: process.env.HOCUSPOCUS_LOGGER_ON_DISCONNECT === 'true',
      onLoadDocument: process.env.HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT === 'true',
      onChange: process.env.HOCUSPOCUS_LOGGER_ON_CHANGE === 'true',
      onUpgrade: process.env.HOCUSPOCUS_LOGGER_ON_UPGRADE === 'true',
      onRequest: process.env.HOCUSPOCUS_LOGGER_ON_REQUEST === 'true',
      onListen: process.env.HOCUSPOCUS_LOGGER_ON_LISTEN === 'true',
      onDestroy: process.env.HOCUSPOCUS_LOGGER_ON_DESTROY === 'true',
      onConfigure: process.env.HOCUSPOCUS_LOGGER_ON_CONFIGURE === 'true'
    },
    throttle: {
      enabled: process.env.HOCUSPOCUS_THROTTLE === 'true',
      attempts: parseInt(process.env.HOCUSPOCUS_THROTTLE_ATTEMPTS || '10', 10),
      banTime: parseInt(process.env.HOCUSPOCUS_THROTTLE_BANTIME || '60000', 10)
    }
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || ''
  },

  // Redis
  redis: {
    enabled: process.env.REDIS === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },

  // Storage
  storage: {
    local: {
      enabled: process.env.PERSIST_TO_LOCAL_STORAGE === 'true',
      path: process.env.LOCAL_STORAGE_PATH || './temp'
    },
    s3: {
      endpoint: process.env.DO_STORAGE_ENDPOINT || '',
      region: process.env.DO_STORAGE_REGION || 'us-east-1',
      bucket: process.env.DO_STORAGE_BUCKET || '',
      accessKeyId: process.env.DO_STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.DO_STORAGE_SECRET_ACCESS_KEY || '',
      maxFileSize: parseInt(process.env.DO_STORAGE_MAX_FILE_SIZE || '4194304', 10)
    }
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },

  // Security
  security: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  }
} as const

export default config
