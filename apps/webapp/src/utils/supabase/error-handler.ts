export const isLocalSupabase = (url: string | URL): boolean => {
  const urlStr = String(url)
  return (
    urlStr.includes('127.0.0.1:54321') ||
    urlStr.includes('localhost:54321') ||
    urlStr.includes('host.docker.internal:54321')
  )
}

/** Against a local stack the fix is a command, so say it instead of a generic message. */
export const createSupabaseError = (error: any, url: string | URL): Error => {
  const urlStr = String(url)
  const isLocal = isLocalSupabase(urlStr)

  if (isLocal) {
    return new Error('Supabase is not running. Run: bun --filter @docs.plus/supabase_back start')
  }

  return new Error(
    `Cannot connect to Supabase. Check your network connection and Supabase project status.`
  )
}

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

/** Pass the result as the `fetch` option of a Supabase client. */
export const createSupabaseFetch = () => {
  return async (url: RequestInfo | URL, options: RequestInit = {}) => {
    try {
      return await fetch(url, options)
    } catch (error: any) {
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
