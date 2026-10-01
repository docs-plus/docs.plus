import { removeReaction } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useAuthStore } from '@stores'
import { captureUnknown } from '@utils/observability'
import { twMerge } from '@utils/twMerge'
import { useCallback, useMemo } from 'react'
type Props = {
  className?: string
}
const ReactionList = ({ className }: Props) => {
  const { variant } = useChatroomContext()
  const { message } = useMessageCardContext()
  const currentUser = useAuthStore((state) => state.profile)

  const isUserReaction = useCallback(
    (users: Array<{ user_id: string }>) => users.some(({ user_id }) => user_id === currentUser?.id),
    [currentUser]
  )

  const handleReactionClick = useCallback(
    (emoji: string) =>
      removeReaction(message, emoji).catch((error) =>
        captureUnknown(error, { tags: { surface: 'chat-action' } })
      ),
    [message]
  )

  const reactionEntries = useMemo(
    () =>
      message.reactions
        ? Object.entries(message.reactions as Record<string, Array<{ user_id: string }>>)
        : [],
    [message.reactions]
  )

  if (!message.reactions || reactionEntries.length === 0) return null

  return (
    <>
      {reactionEntries.map(([emoji, users]) => {
        const currentUserReacted = isUserReaction(users)
        // Only your own reaction on desktop does anything; the rest stay static spans.
        const interactive = currentUserReacted && variant !== 'mobile'
        const Pill = interactive ? 'button' : 'span'
        const count = users.length
        return (
          <Pill
            type={interactive ? 'button' : undefined}
            aria-label={interactive ? `Remove your ${emoji} reaction (${count})` : undefined}
            className={twMerge(
              'badge bg-base-300 relative flex items-center justify-center gap-0 overflow-hidden !p-0',
              currentUserReacted
                ? 'border-primary cursor-pointer border-1'
                : 'border-base-300 cursor-default',
              interactive &&
                'group focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none',
              className
            )}
            key={emoji}
            onClick={interactive ? () => handleReactionClick(emoji) : undefined}>
            {/* Base-content 10% over base-300 is the one hover step that holds in every theme. */}
            <span
              aria-hidden
              className="group-hover:bg-base-content/10 flex h-full items-center transition-colors">
              {/* @ts-ignore */}
              <em-emoji
                native={emoji}
                set="native"
                size="1.2rem"
                className={`flex-shrink-0 pl-[4px] ${count <= 1 && 'pr-[4px]'}`}
              />

              {count > 1 && (
                <span className="badge badge-xs border-none !bg-transparent tabular-nums">
                  {count}
                </span>
              )}
            </span>
            {interactive ? null : <span className="sr-only">{`${emoji} ${count}`}</span>}
          </Pill>
        )
      })}
    </>
  )
}

export default ReactionList
