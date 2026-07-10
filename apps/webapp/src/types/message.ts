/**
 * Lifecycle of a chat message in the local store.
 * `pending` = optimistic row pre-roundtrip; `sent` = server-confirmed;
 * `failed` = INSERT rejected (UI shows retry). Absent = `sent` (server fetches).
 */
export type MessageStatus = 'pending' | 'sent' | 'failed'

export type MessageMediaKind = 'image' | 'video' | 'audio' | 'file'

export type MessageMediaItem = {
  /** Legacy public URL, signed URL, or storage path used before resolve. */
  url: string
  /** Canonical `{userId}/{channelId}/{uuid}.ext` — preferred for private bucket. */
  path?: string
  type: MessageMediaKind
  name?: string
  size?: number
  /** Intrinsic pixel size when known (upload-time best-effort). */
  width?: number
  height?: number
  /** When true, feed blurs image until the viewer taps to reveal. */
  spoiler?: boolean
}
