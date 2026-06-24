import type { MessageMediaItem, TGroupedMsgRow } from '@types'
import { getSanitizedMessageBodyHtml, isOnlyEmoji } from '@utils/index'

import { parseMessageMedias, resolveOutgoingMessageType } from './messageMediaPaths'

export type MessageSurfaceLayout = 'text-only' | 'media-only' | 'media-with-caption'

export type MessagePresentation = {
  medias: MessageMediaItem[]
  hasCaption: boolean
  layout: MessageSurfaceLayout
  displayType: string
  hasMedia: boolean
}

export function deriveMessagePresentation(
  message: Pick<TGroupedMsgRow, 'medias' | 'html' | 'content' | 'type'>
): MessagePresentation {
  const medias = parseMessageMedias(message.medias)
  const bodyHtml = getSanitizedMessageBodyHtml(message.html, message.content || '')
  const hasCaption = !isOnlyEmoji(message.content?.trim() || '') && bodyHtml.trim().length > 0
  const layout: MessageSurfaceLayout =
    medias.length === 0 ? 'text-only' : hasCaption ? 'media-with-caption' : 'media-only'
  const displayType =
    message.type && message.type !== 'text'
      ? message.type
      : medias.length === 0 || hasCaption
        ? 'text'
        : resolveOutgoingMessageType('', medias)

  return {
    medias,
    hasCaption,
    layout,
    displayType,
    hasMedia: medias.length > 0
  }
}
