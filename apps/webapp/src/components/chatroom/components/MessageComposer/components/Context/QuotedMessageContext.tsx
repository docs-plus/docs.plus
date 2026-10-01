import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { Icons } from '@icons'
import { messagePreviewText } from '@utils/messagePreview'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useScrollFeedOnContextOpen } from '../../hooks/useScrollFeedOnContextOpen'
import { ContextBarMediaThumb } from './ContextBarMediaThumb'
import { MessageContextBar } from './MessageContextBar'

const KIND = {
  reply: {
    Icon: Icons.reply,
    label: 'Reply',
    labelClassName: 'text-xs font-semibold text-[var(--info-ink)] antialiased',
    authorFallback: 'someone',
    authorPrefix: 'to ',
    dismissLabel: 'Dismiss reply'
  },
  edit: {
    Icon: Icons.edit,
    label: 'Edit message',
    labelClassName: 'text-xs font-semibold text-[var(--warning-ink)] antialiased',
    authorFallback: '',
    authorPrefix: '',
    dismissLabel: 'Cancel edit'
  }
} as const

/** The reply or edit bar above the composer: who is quoted, a text preview and a media thumb. */
export function QuotedMessageContext({ kind }: { kind: 'reply' | 'edit' }) {
  const { channelId } = useChatroomContext()
  const composer = useMessageComposer()
  const memory = kind === 'reply' ? composer.replyMessageMemory : composer.editMessageMemory
  const setMemory = kind === 'reply' ? composer.setReplyMsgMemory : composer.setEditMsgMemory
  const { Icon, label, labelClassName, authorFallback, authorPrefix, dismissLabel } = KIND[kind]

  useScrollFeedOnContextOpen(memory)

  if (!memory || memory.channel_id !== channelId) return null

  const author =
    memory.user_details?.fullname?.trim() || memory.user_details?.username?.trim() || authorFallback

  const medias = parseMessageMedias(memory.medias)
  const preview = messagePreviewText(memory.content, medias, memory.type)

  return (
    <MessageContextBar
      kind={kind}
      icon={<Icon size={16} />}
      onDismiss={() => setMemory(channelId, null)}
      dismissLabel={dismissLabel}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={labelClassName}>
            {label}
            {author ? (
              <span className="text-base-content ml-1 font-normal">
                {authorPrefix}
                {author}
              </span>
            ) : null}
          </span>
          {preview ? (
            <span className="text-base-content/70 line-clamp-2 break-words wrap-anywhere whitespace-pre-wrap">
              {preview}
            </span>
          ) : null}
        </div>
        <ContextBarMediaThumb medias={medias} />
      </div>
    </MessageContextBar>
  )
}
