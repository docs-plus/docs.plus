import { RenameDialog } from '@components/ui/dialogs/RenameDialog'
import { useStore } from '@stores'

import type { DocumentsListScope } from '../documentsQueryKey'
import useCommitDocumentRename from '../hooks/useCommitDocumentRename'

interface RenameDocumentDialogProps {
  documentId: string
  currentTitle: string | null
  scope: DocumentsListScope
}

/**
 * Grid-tile rename surface (openDialog). The tile title is line-clamp-2, so a dialog
 * is used instead of an inline swap. Stays mounted until the PUT settles so its
 * mutate-scoped rollback + toast still fire (an inline close would drop them).
 */
function RenameDocumentDialog({ documentId, currentTitle, scope }: RenameDocumentDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)
  const { commit, isPending } = useCommitDocumentRename(scope)

  const handleSave = async (draft: string) => {
    const fired = await commit(documentId, currentTitle, draft, { onSettled: closeDialog })
    if (!fired) closeDialog()
  }

  return (
    <RenameDialog
      initialValue={currentTitle ?? ''}
      maxLength={255}
      busy={isPending}
      onSave={handleSave}
    />
  )
}

export default RenameDocumentDialog
