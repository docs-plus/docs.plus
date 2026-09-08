import { getMetadataProperty } from '@utils/metadata'
import { supabaseClient } from '@utils/supabase'

import type { PadTitleChangeNotice } from './types'

const readTitle = (metadata: unknown, key: 'title_from' | 'title_to'): string => {
  const value = getMetadataProperty<unknown>(metadata, key)
  return typeof value === 'string' ? value : ''
}

/** Latest live title_changed notice. Browser client + RLS, not fetch_message_window. */
export async function getLatestPadTitleChange(
  documentId: string
): Promise<PadTitleChangeNotice | null> {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('metadata')
      .eq('channel_id', documentId)
      .eq('type', 'notification')
      .contains('metadata', { type: 'title_changed' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    const titleFrom = readTitle(data.metadata, 'title_from')
    const titleTo = readTitle(data.metadata, 'title_to')
    const snapshotName = getMetadataProperty<unknown>(data.metadata, 'user_name')
    const userName = typeof snapshotName === 'string' ? snapshotName.trim() : ''

    return {
      titleFrom,
      titleTo,
      userName: userName || 'someone'
    }
  } catch {
    return null
  }
}
