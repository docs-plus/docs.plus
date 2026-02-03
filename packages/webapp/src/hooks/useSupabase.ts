import { AuthError } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

// Define a generic type for the Supabase function
type SupabaseFunction<TData, TError = AuthError | null> = (
  ...args: any
) => Promise<{ data: TData; error: TError }>

export const useSupabase = <TData = unknown, TError = AuthError | null>(
  apiFunc: SupabaseFunction<TData, TError>,
  initialArgs?: any | null,
  immediate: boolean = true
) => {
  const [data, setData] = useState<TData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<TError | null>(null)

  const request = useCallback(
    async (...args: any) => {
      setLoading(true)
      let response = null
      try {
        response = await apiFunc(...args)

        setData(response.data)
        const nextError = (response.error ?? null) as TError | null
        setError(nextError)
      } catch (err) {
        setError(err as TError)
        console.error({ apiFunc, error: err, args })
        throw err
      } finally {
        setLoading(false)
      }

      return response
    },
    [apiFunc]
  )

  // Execute the request immediately if the immediate flag is true
  useEffect(() => {
    if (immediate && initialArgs !== undefined) {
      request(...initialArgs)
    }
  }, [request, immediate, initialArgs])

  return { data, setData, loading, setLoading, error, request }
}
