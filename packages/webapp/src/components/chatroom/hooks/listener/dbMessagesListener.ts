import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { TMsgRow } from '@types'

import { messageInsert, messageUpdate } from './helpers'

export const dbMessagesListener = (payload: RealtimePostgresChangesPayload<TMsgRow>) => {
  if (payload.eventType === 'INSERT') messageInsert(payload)
  if (payload.eventType === 'UPDATE') messageUpdate(payload)
}
