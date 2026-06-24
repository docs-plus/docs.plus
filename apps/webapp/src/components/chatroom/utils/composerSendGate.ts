import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { ComposerMessageMemory } from '@types'

export const editHadPersistedMedias = (
  editMessageMemory: ComposerMessageMemory | null | undefined
): boolean => editMessageMemory != null && parseMessageMedias(editMessageMemory.medias).length > 0

export type ComposerSendGateInput = {
  text: string
  readyAttachmentCount: number
  editMessageMemory: ComposerMessageMemory | null | undefined
  isUploading: boolean
  hasUploadErrors: boolean
}

/** Reactive send affordance: content, ready attachments, or an edit that already had medias. */
export const composerSendGate = ({
  text,
  readyAttachmentCount,
  editMessageMemory,
  isUploading,
  hasUploadErrors
}: ComposerSendGateInput): boolean => {
  if (isUploading || hasUploadErrors) return false
  return (
    text.trim().length > 0 || readyAttachmentCount > 0 || editHadPersistedMedias(editMessageMemory)
  )
}
