import type { Database, MessageMediaItem } from '@types'

export type SendResult = 'sent' | 'failed' | 'auth_required'

export type SendDraft = {
  content: string
  html?: string | null
  reply_to_message_id?: string | null
  medias?: MessageMediaItem[] | null
  type?: Database['public']['Enums']['message_type'] | null
  /** Set when the composer already ran ensureChatMediaInsertReady — skips a second probe in persistChatMessage. */
  storageVerified?: true
}
