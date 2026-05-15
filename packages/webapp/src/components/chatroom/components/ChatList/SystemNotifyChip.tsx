import type { MessageRow } from '@components/chatroom/types/chat-items'
import { DocsPlusIcon } from '@icons'
import { useStore } from '@stores'
import { getMetadataProperty } from '@utils/metadata'
import { formatDistanceToNow } from 'date-fns'

import { useMentionClick } from '../../hooks/useMentionClick'

type Props = { message: MessageRow }

const CHIP_CLASSES =
  'bg-info/10 inline-flex max-w-[90%] flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-3 py-1.5 text-center text-xs leading-relaxed'

const WRAPPER_CLASSES = 'msg_card chat my-3 flex justify-center px-2 pb-1'

/**
 * Centered chip render for `messages.type = 'notification'`. The
 * `metadata.type` discriminator covers the three product cases:
 *   - `user_join_workspace` — "@user joined 📄 doc — Xh ago"
 *   - `channel_created`     — "Heading created — Xh ago"
 *   - `user_join_channel`   — suppressed (workspace-join chip already
 *                              records first appearance)
 * Fallback renders raw `content` as a generic chip.
 */
export const SystemNotifyChip = ({ message }: Props) => {
  const docMetadata = useStore((state) => state.settings.metadata)
  const handleMentionClick = useMentionClick()

  const metadataType = getMetadataProperty<string>(message.metadata, 'type')
  if (metadataType === 'user_join_channel') return null

  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : ''
  const dateAttr = (message.created_at ?? '').slice(0, 10) || undefined

  if (metadataType === 'user_join_workspace') {
    return (
      <div className={WRAPPER_CLASSES} data-msg-date={dateAttr} onClick={handleMentionClick}>
        <div className={CHIP_CLASSES}>
          <span
            className="mention text-primary cursor-pointer !p-0 font-semibold"
            data-type="mention"
            data-id={message.user_id ?? ''}
            data-label={message.user_details?.username ?? ''}>
            @{message.user_details?.username}
          </span>
          <span>joined</span>
          <span className="inline-flex items-center gap-1">
            <DocsPlusIcon size={12} />
            <span className="font-medium underline">{docMetadata?.title}</span>
          </span>
          <span>— {timeAgo}</span>
        </div>
      </div>
    )
  }

  if (metadataType === 'channel_created') {
    return (
      <div className={WRAPPER_CLASSES} data-msg-date={dateAttr}>
        <div className={CHIP_CLASSES}>Heading created — {timeAgo}</div>
      </div>
    )
  }

  return (
    <div className={WRAPPER_CLASSES} data-msg-date={dateAttr}>
      <div className={CHIP_CLASSES}>{message.content}</div>
    </div>
  )
}
