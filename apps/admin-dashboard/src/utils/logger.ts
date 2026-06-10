/**
 * Production-safe logging utility
 *
 * Only logs in development environment to prevent information leakage
 * in production browser console.
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Log error messages (only in development)
 */
export function logError(message: string, error?: unknown): void {
  if (isDev) {
    console.error(message, error)
  }
}
