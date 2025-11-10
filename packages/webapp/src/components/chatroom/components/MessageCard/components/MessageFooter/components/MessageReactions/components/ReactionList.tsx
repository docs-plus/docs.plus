import { removeReaction } from '@api'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useAuthStore } from '@stores'
import { useCallback, useMemo } from 'react'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { twMerge } from 'tailwind-merge'
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
    (emoji: string) => {
      if (isUserReaction((message.reactions as any)?.[emoji] || [])) {
        removeReaction(message, emoji).catch(console.error)
      }
    },
    [message, isUserReaction, message.reactions]
  )

  const reactionEntries = useMemo(
    () => (message.reactions ? Object.entries(message.reactions) : []),
    [message.reactions]
  )

  if (!message.reactions || reactionEntries.length === 0) return null

  return (
    <>
      {reactionEntries.map(([emoji, users]: [string, any], index) => {
        const currentUserReacted = isUserReaction(users)
        return (
          <span
            className={twMerge(
              'badge bg-base-300 relative flex items-center justify-center gap-0 !p-0',
              currentUserReacted
                ? 'border-docsy cursor-pointer border-1'
                : 'cursor-default border-gray-300',
              className
            )}
            key={index}
            onClick={() => variant !== 'mobile' && handleReactionClick(emoji)}>
            {/* @ts-ignore */}
            <em-emoji
              native={emoji}
              set="native"
              size="1.2rem"
              className={`flex-shrink-0 pl-[4px] ${users.length <= 1 && 'pr-[4px]'}`}
            />

            {users.length > 1 && (
              <div className="badge badge-xs border-none !bg-transparent !font-mono">
                {users.length}
              </div>
            )}
          </span>
        )
      })}
    </>
  )
}

export default ReactionList
