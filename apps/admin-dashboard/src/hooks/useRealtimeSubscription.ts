import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeSubscriptionOptions {
  table: string
  schema?: string
  event?: PostgresChangeEvent
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  enabled?: boolean
}

/**
 * Subscribe to Supabase Realtime postgres_changes for a single table.
 * Pass a stable (memoized) `onChange` so the effect doesn't resubscribe each render.
 */
export function useRealtimeSubscription({
  table,
  schema = 'public',
  event = '*',
  onChange,
  enabled = true
}: UseRealtimeSubscriptionOptions) {
  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(`admin-${table}-changes`)
      .on('postgres_changes', { event, schema, table }, onChange)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, event, onChange, enabled])
}
