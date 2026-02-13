import { DocsPlus } from '@icons'
import { useStore } from '@stores'
import { TMsgRow } from '@types'
import { getMetadataProperty } from '@utils/metadata'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useRef } from 'react'

import { useMessageListContext } from '../MessageListContext'

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

  const metadataType = getMetadataProperty<string>(message.metadata, 'type')

  // Don't render join channel notifications
  if (metadataType === 'user_join_channel') return null

  if (metadataType === 'user_join_workspace') {
    return (
      <div
        className="msg_card chat my-2 flex justify-center pb-1"
        onClick={handleMentionClick}
        ref={cardRef}>
        <div className="badge bg-info/10 py-3">
          <span
            className="mention text-primary cursor-pointer !p-0 font-semibold"
            data-type="mention"
            data-id={message.user_id}
            data-label={message?.user_details?.username}>
            @{message?.user_details?.username}
          </span>
          <span>joined</span>
          <span className="bg-info/10 flex items-center gap-1 py-0.5">
            <DocsPlus size={12} className="mb-1" />
            <span className="font-medium underline">{docMetadata.title}</span>
            {'-'}{' '}
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true
            })}
          </span>
        </div>
      </div>
    )
  }

  if (metadataType === 'channel_created') {
    return (
      <div className="msg_card chat my-4 flex justify-center pb-1" ref={cardRef}>
        <div className="badge bg-info/10 border-none">
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
      <div className="badge bg-info/10 border-none">{message.content}</div>
    </div>
  )
}
