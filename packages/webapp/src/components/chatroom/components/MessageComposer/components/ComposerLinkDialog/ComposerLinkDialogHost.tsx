import { useChatStore, useSheetStore } from '@stores'
import { AnimatePresence } from 'motion/react'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useComposerLinkDialogStore } from '../../stores/composerLinkDialogStore'
import { ComposerLinkEditorDialog } from './ComposerLinkEditorDialog'
import { ComposerLinkPreviewDialog } from './ComposerLinkPreviewDialog'

export function ComposerLinkDialogHost() {
  const { phase, preview, create, edit, removeLink, openEditFromPreview, save, cancel } =
    useComposerLinkDialogStore(
      useShallow((s) => ({
        phase: s.phase,
        preview: s.preview,
        create: s.create,
        edit: s.edit,
        removeLink: s.removeLink,
        openEditFromPreview: s.openEditFromPreview,
        save: s.save,
        cancel: s.cancel
      }))
    )
  const headingId = useChatStore((s) => s.chatRoom.headingId)
  const isChatroomOpen = useSheetStore((s) => s.activeSheet === 'chatroom')

  useEffect(() => {
    const onPopState = () => {
      if (useComposerLinkDialogStore.getState().phase !== 'idle') {
        useComposerLinkDialogStore.getState().cancel()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      useComposerLinkDialogStore.getState().close()
    }
  }, [])

  useEffect(() => {
    return () => useComposerLinkDialogStore.getState().close()
  }, [headingId])

  useEffect(() => {
    if (!isChatroomOpen) useComposerLinkDialogStore.getState().close()
  }, [isChatroomOpen])

  return (
    <AnimatePresence>
      {phase === 'preview' && preview && (
        <ComposerLinkPreviewDialog
          key="preview"
          href={preview.href}
          onRemove={removeLink}
          onClose={cancel}
          onEdit={openEditFromPreview}
        />
      )}
      {phase === 'create' && create && (
        <ComposerLinkEditorDialog
          key="create"
          initialHref={create.initialHref}
          initialText={create.initialText}
          validate={create.validate}
          onSave={save}
          onCancel={cancel}
        />
      )}
      {phase === 'edit' && edit && (
        <ComposerLinkEditorDialog
          key="edit"
          initialHref={edit.initialHref}
          initialText={edit.initialText}
          cameFromPreview={Boolean(edit.returnToPreview)}
          validate={edit.validate}
          onSave={save}
          onCancel={cancel}
        />
      )}
    </AnimatePresence>
  )
}
