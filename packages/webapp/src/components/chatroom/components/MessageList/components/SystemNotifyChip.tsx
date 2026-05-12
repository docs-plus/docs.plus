import { DocsPlusIcon } from '@icons'
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

const CHIP_CLASSES =
  'bg-info/10 inline-flex max-w-[90%] flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-3 py-1.5 text-center text-xs leading-relaxed'

const WRAPPER_CLASSES = 'msg_card chat my-3 flex justify-center px-2 pb-1'

export const SystemNotifyChip = ({ message }: Props) => {
  const docMetadata = useStore((state) => state.settings.metadata)
  const cardRef = useRef<MessageCardDesktopElement>(null)

  const { handleMentionClick } = useMessageListContext()

  useEffect(() => {
    if (!cardRef.current) return
    cardRef.current.msgId = message.id
    cardRef.current.readedAt = message.readed_at
    cardRef.current.createdAt = message.created_at
    cardRef.current.user_id = message.user_id
  }, [message])

  const metadataType = getMetadataProperty<string>(message.metadata, 'type')

  if (metadataType === 'user_join_channel') return null

  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true })

  if (metadataType === 'user_join_workspace') {
    return (
      <div className={WRAPPER_CLASSES} onClick={handleMentionClick} ref={cardRef}>
        <div className={CHIP_CLASSES}>
          <span
            className="mention text-primary cursor-pointer !p-0 font-semibold"
            data-type="mention"
            data-id={message.user_id}
            data-label={message?.user_details?.username}>
            @{message?.user_details?.username}
          </span>
          <span>joined</span>
          <span className="inline-flex items-center gap-1">
            <DocsPlusIcon size={12} />
            <span className="font-medium underline">{docMetadata.title}</span>
          </span>
          <span>— {timeAgo}</span>
        </div>
      </div>
    )
  }

  if (metadataType === 'channel_created') {
    return (
      <div className={WRAPPER_CLASSES} ref={cardRef}>
        <div className={CHIP_CLASSES}>Heading created — {timeAgo}</div>
      </div>
    )
  }

  return (
    <div className={WRAPPER_CLASSES} ref={cardRef}>
      <div className={CHIP_CLASSES}>{message.content}</div>
    </div>
  )
}
