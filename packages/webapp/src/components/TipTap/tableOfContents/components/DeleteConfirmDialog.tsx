import React from 'react'
import { useStore } from '@stores'
import { useHeadingActions } from '../hooks'

interface DeleteConfirmDialogProps {
  headingId: string
}

const DeleteConfirmDialog = ({ headingId }: DeleteConfirmDialogProps) => {
  const { closeDialog } = useStore()
  const { deleteSection } = useHeadingActions()

  const handleDelete = deleteSection(headingId, closeDialog)

  return (
    <div className="flex flex-col gap-3 p-4 pb-3 pr-3">
      <p className="text-gray-600">Do you want to delete this heading section?</p>
      <div className="flex justify-end gap-4">
        <button className="btn btn-ghost" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn btn-ghost text-red-500" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}

export default DeleteConfirmDialog
