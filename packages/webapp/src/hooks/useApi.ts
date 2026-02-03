import { PostgrestError, PostgrestResponse, PostgrestSingleResponse } from '@supabase/postgrest-js'
import { useCallback, useEffect, useState } from 'react'

// Define a generic type for the API function
type ApiFunction<TData> = (
  ...args: any
) => Promise<PostgrestResponse<TData> | PostgrestSingleResponse<TData>>

// Use generic types to make the hook flexible for different data and error types
export const useApi = <TData = unknown, TError = PostgrestError>(
  apiFunc: ApiFunction<TData>,
  initialArgs?: any | null,
  immediate: boolean = true
) => {
  const [data, setData] = useState<TData[] | TData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<TError | null>(null)

  const request = useCallback(
    async (...args: any) => {
      setLoading(true)
      let response = null
      try {
        response = await apiFunc(...args)
        if (response.error) {
          throw response.error
        }
        setData(response.data)
      } catch (error) {
        setError(error as TError)
        console.error({ apiFunc, error, args })
        throw error
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
