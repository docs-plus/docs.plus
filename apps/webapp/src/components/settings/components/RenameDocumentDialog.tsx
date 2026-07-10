import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useStore } from '@stores'
import { useEffect, useRef, useState } from 'react'

import useCommitDocumentRename from '../hooks/useCommitDocumentRename'
import type { DocumentSortKey } from '../types'

interface RenameDocumentDialogProps {
  documentId: string
  currentTitle: string | null
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
}

/**
 * Grid-tile rename surface (openDialog). The tile title is line-clamp-2, so a dialog
 * is used instead of an inline swap. Stays mounted until the PUT settles so its
 * mutate-scoped rollback + toast still fire (an inline close would drop them).
 */
function RenameDocumentDialog({
  documentId,
  currentTitle,
  userId,
  searchQuery,
  sortKey
}: RenameDocumentDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)
  const { commit, isPending } = useCommitDocumentRename(userId, searchQuery, sortKey)
  const [draft, setDraft] = useState(currentTitle ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.select(), 120)
    return () => clearTimeout(timer)
  }, [])

  const handleSave = async () => {
    const fired = await commit(documentId, currentTitle, draft, { onSettled: closeDialog })
    if (!fired) closeDialog()
  }

  return (
    <div className="p-5">
      <TextInput
        ref={inputRef}
        labelPosition="above"
        label="Rename document"
        value={draft}
        maxLength={255}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') closeDialog()
        }}
        placeholder="Document title"
        autoComplete="off"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isPending || !draft.trim()}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

export default RenameDocumentDialog
