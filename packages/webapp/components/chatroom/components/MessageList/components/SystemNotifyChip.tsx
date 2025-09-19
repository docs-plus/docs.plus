import { useStore } from '@stores'
import { useMessageListContext } from '../MessageListContext'
import { DocsPlus } from '@icons'
import { TMsgRow } from '@types'
import { useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'

export interface MessageCardDesktopElement extends HTMLDivElement {
  msgId?: string
  readedAt?: string | null
  createdAt?: string | null
  user_id?: string | null
}

type Props = {
  message: TMsgRow
}

export const SystemNotifyChip = ({ message }: Props) => {
  const {
    settings: { metadata: docMetadata }
  } = useStore((state) => state)
  const cardRef = useRef<MessageCardDesktopElement>(null)

  const { handleMentionClick } = useMessageListContext()

  useEffect(() => {
    // if (ref) {
    //   ref.current = cardRef.current
    // }

    if (!cardRef.current) return

    cardRef.current.msgId = message.id
    cardRef.current.readedAt = message.readed_at
    cardRef.current.createdAt = message.created_at
    cardRef.current.user_id = message.user_id
  }, [/*ref,*/ message, cardRef])

  // Don't render join channel notifications
  if (message.metadata?.type === 'user_join_channel') return null

  if (message.metadata?.type === 'user_join_workspace') {
    return (
      <div
        className="msg_card chat my-4 flex justify-center pb-1"
        onClick={handleMentionClick}
        ref={cardRef}>
        <div className="badge bg-bg-chatBubble-owner py-3">
          <span
            className="mention text-primary cursor-pointer !p-0 font-semibold"
            data-type="mention"
            data-id={message.user_id}
            data-label={message?.user_details?.username}>
            @{message?.user_details?.username}
          </span>
          <span>joined</span>
          <span className="bg-bg-chatBubble-owner flex items-center gap-1 py-0.5">
            <DocsPlus size={12} className="mb-1" />
            <span className="font-medium underline">{docMetadata.title}</span>
          </span>
        </div>
      </div>
    )
  }

  if (message.metadata?.type === 'channel_created') {
    return (
      <div className="msg_card chat my-4 flex justify-center pb-1" ref={cardRef}>
        <div className="badge bg-bg-chatBubble-owner border-none">
          Heading created -{' '}
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="msg_card chat my-4 flex justify-center pb-1" ref={cardRef}>
      <div className="badge bg-bg-chatBubble-owner border-none">{message.content}</div>
    </div>
  )
}
