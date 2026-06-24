import { MESSAGE_MEDIA_KIND_LABEL } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem, MessageMediaKind } from '@types'

/** Shown when a message carries attachments but no descriptive text or single-kind label. */
export const GENERIC_ATTACHMENT_LABEL = 'Attachment'

const MULTI_ATTACHMENT_PATTERN = /^\d+ attachments$/

const multiAttachmentPreviewLabel = (count: number): string => `${count} attachments`

/** Sidebar/reply/notification preview when content is empty but attachments exist. */
export function messageAttachmentPreviewLabel(
  medias: MessageMediaItem[],
  messageType?: string | null
): string | null {
  if (medias.length === 0) return null

  if (medias.length === 1) {
    const media = medias[0]!
    if (media.type === 'file' && media.name?.trim()) {
      return media.name.trim()
    }
    if (messageType && messageType !== 'text' && messageType in MESSAGE_MEDIA_KIND_LABEL) {
      return MESSAGE_MEDIA_KIND_LABEL[messageType as keyof typeof MESSAGE_MEDIA_KIND_LABEL]
    }
    return MESSAGE_MEDIA_KIND_LABEL[media.type]
  }

  return multiAttachmentPreviewLabel(medias.length)
}

export function messagePreviewText(
  content: string | null | undefined,
  medias: MessageMediaItem[],
  messageType?: string | null
): string {
  const trimmed = content?.trim() ?? ''
  if (trimmed.length > 0) return trimmed
  return messageAttachmentPreviewLabel(medias, messageType) ?? ''
}

/**
 * Inverse of messageAttachmentPreviewLabel — maps a preview string back to a media kind
 * for icon display. Shares the producer's label table and literals so a label rename
 * can't silently desync the notification/bookmark hint (pinned by a round-trip test).
 */
export function messagePreviewKind(preview: string): MessageMediaKind | 'multi' | null {
  const trimmed = preview.trim()
  if (!trimmed) return null

  for (const [kind, label] of Object.entries(MESSAGE_MEDIA_KIND_LABEL) as Array<
    [MessageMediaKind, string]
  >) {
    if (trimmed === label) return kind
  }
  if (MULTI_ATTACHMENT_PATTERN.test(trimmed)) return 'multi'
  if (trimmed === GENERIC_ATTACHMENT_LABEL) return 'file'
  return null
}
