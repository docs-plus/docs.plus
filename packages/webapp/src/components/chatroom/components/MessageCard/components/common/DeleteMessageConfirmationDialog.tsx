import { useDeleteMessageHandler } from '../../hooks/useDeleteMessageHandler'
import { TMsgRow } from '@types'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

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
    <div className="flex flex-col gap-3 p-4 pr-3 pb-3">
      <div>
        <p className="text-gray-600">Do you want to delete this message?</p>
      </div>
      <div className="flex justify-end gap-4">
        <button className="btn btn-ghost" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn btn-ghost" onClick={handleDeleteConfirm}>
          Delete
        </button>
      </div>
    </div>
  )
}
