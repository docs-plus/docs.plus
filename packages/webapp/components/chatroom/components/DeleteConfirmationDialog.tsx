import React from 'react'
import { Modal, ModalContent } from '@components/ui/Dialog'
import { TMsgRow } from '@types'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  message: TMsgRow | null
  isDeleting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  isDeleting = false,
  onConfirm,
  onCancel
}) => {
  console.log('DeleteConfirmationDialog', isOpen, isOpen, isDeleting)
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <ModalContent size="sm">
        <div className="flex flex-col gap-4 p-4">
          <div className="">
            <p className="text-gray-600">Do you want to delete this message?</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} disabled={isDeleting} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isDeleting} className="btn btn-ghost">
              {isDeleting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              )}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}
