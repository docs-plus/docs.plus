/**
 * Environment variable validation
 * Validates required environment variables on app startup
 */

import { logger } from '@utils/logger'

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_PROVIDER_URL'
] as const

const optionalEnvVars = ['NEXT_PUBLIC_RESTAPI_URL', 'NEXT_PUBLIC_GA_ID'] as const

export function validateEnv() {
  // Only validate on server-side
  if (typeof window !== 'undefined') {
    return
  }

  // Skip validation during Next.js build phase
  // During build, Next.js executes server code but env vars may not be available yet
  // NEXT_PHASE is set by Next.js during build process
  const isBuildTime =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'

  if (isBuildTime) {
    return
  }

  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key)
    }
  })

  // Check optional variables
  optionalEnvVars.forEach((key) => {
    if (!process.env[key]) {
      warnings.push(key)
    }
  })

  // Throw error if required vars are missing
  if (missing.length > 0) {
    logger.error('Missing required environment variables', undefined, { missing })
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Log warnings for optional vars
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    logger.warn('Optional environment variables not set', { warnings })
  }

  if (process.env.NODE_ENV !== 'test') {
    logger.info('Environment variables validated successfully')
  }
}

// Auto-validate on module import (server-side only, but skip during build)
validateEnv()
