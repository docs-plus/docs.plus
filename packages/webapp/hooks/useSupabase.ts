import { useState, useCallback, useEffect } from "react";
import { AuthError } from "@supabase/supabase-js";

// Define a generic type for the Supabase function
type SupabaseFunction<TData> = (...args: any) => Promise<{ data: TData; error: AuthError | null }>;

export const useSupabase = <TData = unknown>(
  apiFunc: SupabaseFunction<TData>,
  initialArgs?: any | null,
  immediate: boolean = true,
) => {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AuthError | null>(null);

  const request = useCallback(
    async (...args: any) => {
      setLoading(true);
      let response = null;
      try {
        response = await apiFunc(...args);

        setData(response.data);
      } catch (err) {
        setError(err as AuthError);
        console.error({ apiFunc, error: err, args });
        throw err;
      } finally {
        setLoading(false);
      }

      return response;
    },
    [apiFunc],
  );

  // Execute the request immediately if the immediate flag is true
  useEffect(() => {
    if (immediate && initialArgs !== undefined) {
      request(...initialArgs);
    }
  }, [request, immediate, initialArgs]);

  return { data, setData, loading, setLoading, error, request };
};
