import {
  composerAttachmentKey,
  selectComposerAttachmentsByKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'

/** Store-only attachment list for UI that must not subscribe via MessageComposerContext. */
export const useComposerAttachmentList = (workspaceId: string | undefined, channelId: string) => {
  const storeKey = workspaceId ? composerAttachmentKey(workspaceId, channelId) : channelId
  return useComposerAttachmentsStore(selectComposerAttachmentsByKey(storeKey))
}
