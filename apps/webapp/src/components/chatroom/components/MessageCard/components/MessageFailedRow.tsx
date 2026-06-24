import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMessage } from '@components/chatroom/types/chat-items'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { deleteChatMediaFromStorage } from '@components/chatroom/utils/uploadChatMedia'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../MessageCardContext'

/**
 * Owner-only inline failure row: `Failed to send · Retry · Delete`.
 * Delete is local-only — the message never reached the server — and
 * removes the optimistic row from the Virtuoso feed directly.
 */
export const MessageFailedRow = ({ className }: { className?: string }) => {
  const { message } = useMessageCardContext()
  const { retry, listRef } = useChatroomContext()

  if (!message.isOwner) return null
  if (message.status !== 'failed') return null

  const onRetry = () => {
    void retry(message.id)
  }

  const onDelete = () => {
    const medias = parseMessageMedias(message.medias)
    if (medias.length) {
      void Promise.all(medias.map((item) => deleteChatMediaFromStorage(item)))
    }
    listRef.current?.data.findAndDelete((i) => isMessage(i) && i.id === message.id)
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
