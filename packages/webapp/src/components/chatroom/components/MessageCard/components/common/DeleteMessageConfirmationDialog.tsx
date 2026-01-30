import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import Button from '@components/ui/Button'
import PanelHeader from '@components/ui/PanelHeader'
import { TMsgRow } from '@types'
import { MdDeleteOutline } from 'react-icons/md'

import { useDeleteMessageHandler } from '../../hooks/useDeleteMessageHandler'

type Props = {
  message: TMsgRow
}

export const DeleteMessageConfirmationDialog = ({ message }: Props) => {
  const { deleteMessageHandler } = useDeleteMessageHandler()
  const { closeDialog } = useChatroomContext()

  const handleDeleteConfirm = async () => {
    await deleteMessageHandler(message)
    closeDialog()
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <PanelHeader
        icon={MdDeleteOutline}
        title="Delete Message"
        description="This action cannot be undone"
        variant="error"
      />

      {/* Content */}
      <p className="text-sm text-slate-600">
        Are you sure you want to delete this message? This will permanently remove it from the
        conversation.
      </p>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="error" onClick={handleDeleteConfirm}>
          Delete
        </Button>
      </div>
    </div>
  )
}
