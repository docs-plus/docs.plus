/**
 * Shared error handling utilities for Supabase clients
 * Provides consistent error messages for connection issues
 */

/**
 * Check if Supabase URL is local development instance
 */
export const isLocalSupabase = (url: string | URL): boolean => {
  const urlStr = String(url)
  return (
    urlStr.includes('127.0.0.1:54321') ||
    urlStr.includes('localhost:54321') ||
    urlStr.includes('host.docker.internal:54321')
  )
}

/**
 * Create friendly error message for Supabase connection errors
 */
export const createSupabaseError = (error: any, url: string | URL): Error => {
  const urlStr = String(url)
  const isLocal = isLocalSupabase(urlStr)

  if (isLocal) {
    return new Error('Supabase is not running. Run: make supabase-start')
  }

  // Cloud Supabase - generic error
  return new Error(
    `Cannot connect to Supabase. Check your network connection and Supabase project status.`
  )
}

/**
 * Check if error is a connection refused error
 */
export const isConnectionRefusedError = (error: any): boolean => {
  return (
    error?.code === 'ECONNREFUSED' ||
    error?.message?.includes('ECONNREFUSED') ||
    error?.message?.includes('fetch failed') ||
    error?.cause?.code === 'ECONNREFUSED' ||
    error?.cause?.message?.includes('ECONNREFUSED') ||
    (error?.name === 'TypeError' && error?.message?.includes('fetch failed'))
  )
}

/**
 * Create a fetch wrapper with Supabase error handling
 * Use this in Supabase client configurations
 */
export const createSupabaseFetch = () => {
  return async (url: RequestInfo | URL, options: RequestInit = {}) => {
    try {
      return await fetch(url, options)
    } catch (error: any) {
      // Check for connection refused errors
      if (isConnectionRefusedError(error)) {
        const urlStr = url instanceof Request ? url.url : String(url)
        if (isLocalSupabase(urlStr)) {
          console.error('❌ Supabase connection failed:', error)
          throw createSupabaseError(error, urlStr)
        }
      }
      throw error
    }
  }
}

