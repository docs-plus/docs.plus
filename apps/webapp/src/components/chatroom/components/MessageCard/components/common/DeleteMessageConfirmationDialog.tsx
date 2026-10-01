import { ConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'
import { TMsgRow } from '@types'

import { useDeleteMessageHandler } from '../../hooks/useDeleteMessageHandler'

type Props = {
  message: TMsgRow
}

/** Opens in GlobalDialog, so Cancel and the close after delete use its `closeDialog`. */
export const DeleteMessageConfirmationDialog = ({ message }: Props) => {
  const { deleteMessageHandler } = useDeleteMessageHandler()

  return (
    <ConfirmDialog
      title="Delete this message?"
      body="This permanently removes it from the conversation. You can’t undo this."
      confirmLabel="Delete message"
      waitForConfirm
      onConfirm={() => deleteMessageHandler(message)}
    />
  )
}
