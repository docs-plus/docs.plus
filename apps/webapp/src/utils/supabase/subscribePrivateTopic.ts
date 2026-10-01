import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabaseClient } from '.'

/**
 * Subscribes a private Realtime topic and returns the cleanup. `channel()` hands back a
 * same-topic channel that is still leaving, and subscribing that one is a no-op, so a
 * remount (StrictMode in dev, a workspace switch) waits for the old one to go first.
 */
export function subscribePrivateTopic(
  topic: string,
  bind: (channel: RealtimeChannel) => void
): () => void {
  let stale = false
  let channel: RealtimeChannel | null = null

  void (async () => {
    const leftover = supabaseClient.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (leftover) await supabaseClient.removeChannel(leftover)
    if (stale) return
    channel = supabaseClient.channel(topic, { config: { private: true } })
    bind(channel)
    channel.subscribe()
  })()

  return () => {
    stale = true
    if (channel) void supabaseClient.removeChannel(channel)
  }
}
