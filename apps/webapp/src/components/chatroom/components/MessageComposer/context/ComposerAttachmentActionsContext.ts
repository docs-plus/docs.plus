import { createContext, useContext } from 'react'

export type ComposerAttachmentActions = {
  addFiles: (files: FileList | File[]) => void
  removeAttachment: (id: string) => void
  retryAttachment: (id: string) => void
  clearAttachments: (options?: { deleteStorage?: boolean }) => void
  toggleAttachmentSpoiler: (id: string) => void
}

export const ComposerAttachmentActionsContext = createContext<ComposerAttachmentActions | null>(
  null
)

export const useComposerAttachmentActions = (): ComposerAttachmentActions => {
  const context = useContext(ComposerAttachmentActionsContext)
  if (!context) {
    throw new Error(
      'useComposerAttachmentActions must be used within MessageComposer (attachment actions provider)'
    )
  }
  return context
}
