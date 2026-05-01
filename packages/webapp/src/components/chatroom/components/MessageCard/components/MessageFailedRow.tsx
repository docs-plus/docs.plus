import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import { retryMessage } from '../../../utils/retryMessage'
import { useMessageCardContext } from '../MessageCardContext'

/**
 * Owner-only inline failure row: `Failed to send · Retry · Delete`.
 * Delete is local-only (the message never reached the server), no confirm.
 */
export const MessageFailedRow = ({ className }: { className?: string }) => {
  const { message } = useMessageCardContext()
  const removeMessage = useChatStore((state) => state.removeMessage)

  if (!message.isOwner) return null
  if (message.status !== 'failed') return null

  const onRetry = () => {
    void retryMessage(message.channel_id, message.id)
  }

  const onDelete = () => {
    removeMessage(message.channel_id, message.id)
  }

  return (
    <div className={twMerge('text-error mt-1 flex items-center gap-1.5 text-xs', className)}>
      <span>Failed to send</span>
      <span aria-hidden="true" className="text-base-content/30">
        ·
      </span>
      <button
        type="button"
        onClick={onRetry}
        title={message.statusError ?? 'Retry sending this message'}
        className="hover:underline focus-visible:underline focus-visible:outline-none"
        aria-label="Retry sending message">
        Retry
      </button>
      <span aria-hidden="true" className="text-base-content/30">
        ·
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="text-base-content/60 hover:text-error hover:underline focus-visible:underline focus-visible:outline-none"
        aria-label="Delete failed message">
        Delete
      </button>
    </div>
  )
}
