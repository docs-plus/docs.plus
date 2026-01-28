import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeSubscriptionOptions {
  table: string
  schema?: string
  event?: PostgresChangeEvent
  onchange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  enabled?: boolean
}

/**
 * Hook to subscribe to Supabase Realtime database changes
 */
export function useRealtimeSubscription({
  table,
  schema = 'public',
  event = '*',
  onchange,
  enabled = true
}: UseRealtimeSubscriptionOptions) {
  useEffect(() => {
    if (!enabled) return

    const channelName = `admin-${table}-changes`

    const channel = (supabase.channel(channelName) as any)
      .on(
        'postgres_changes',
        { event, schema, table },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onchange(payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, event, onchange, enabled])
}

/**
 * Hook to subscribe to multiple tables
 */
export function useMultiTableSubscription(tables: string[], onchange: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || tables.length === 0) return

    const channelName = `admin-multi-${tables.join('-')}`

    let channel: any = supabase.channel(channelName)

    // Subscribe to each table
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        onchange()
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tables, onchange, enabled])
}
