import { logger } from '@utils/logger'

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_PROVIDER_URL'
] as const

const optionalEnvVars = ['NEXT_PUBLIC_RESTAPI_URL', 'NEXT_PUBLIC_GA_ID'] as const

export function validateEnv() {
  if (typeof window !== 'undefined') {
    return
  }

  // Next.js runs server code during the build phase, before env vars exist.
  const isBuildTime =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'

  if (isBuildTime) {
    return
  }

  const missing: string[] = []
  const warnings: string[] = []

  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key)
    }
  })

  optionalEnvVars.forEach((key) => {
    if (!process.env[key]) {
      warnings.push(key)
    }
  })

  if (missing.length > 0) {
    logger.error('Missing required environment variables', undefined, { missing })
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    logger.warn('Optional environment variables not set', { warnings })
  }

  if (process.env.NODE_ENV !== 'test') {
    logger.info('Environment variables validated successfully')
  }
}

validateEnv()
