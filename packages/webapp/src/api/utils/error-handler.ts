/**
 * Standardized error handling for Supabase API calls
 * Provides consistent error handling across all API functions
 */

import { PostgrestResponse, PostgrestError } from '@supabase/supabase-js'
import { logger } from '@utils/logger'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Handle Supabase errors with proper typing and logging
 */
export function handleSupabaseError<T>(
  result: PostgrestResponse<T>,
  context?: { operation: string; resource?: string }
): PostgrestResponse<T> {
  if (result.error) {
    const error = result.error as PostgrestError
    const message = context?.operation
      ? `${context.operation} failed${context.resource ? ` for ${context.resource}` : ''}`
      : 'Database operation failed'

    logger.error(message, error, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      ...context
    })

    throw new ApiError(
      error.message || message,
      parseInt(error.code || '500', 10) || 500,
      error.code || 'DATABASE_ERROR',
      {
        details: error.details,
        hint: error.hint
      }
    )
  }

  return result
}

/**
 * Wrapper for Supabase queries that automatically handles errors
 * Use this instead of manual error checking
 */
export async function safeSupabaseQuery<T>(
  query: Promise<PostgrestResponse<T>>,
  context?: { operation: string; resource?: string }
): Promise<T> {
  try {
    const result = await query
    handleSupabaseError(result, context)
    return result.data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error('Unexpected error in Supabase query', error as Error, context)
    throw new ApiError('An unexpected error occurred', 500, 'UNEXPECTED_ERROR', error)
  }
}

/**
 * Type-safe wrapper for Supabase responses
 * Ensures proper typing and error handling
 */
export type SafePostgrestResponse<T> = {
  data: T
  error: null
  count: number | null
}
