import React, { useCallback } from 'react'
import { useAuthStore } from '@stores'
import { removeReaction } from '@api'

interface ReactionsCardProps {
  reactions: { [emoji: string]: Array<{ user_id: string }> }
  message: any
}

const ReactionsCard: React.FC<ReactionsCardProps> = ({ reactions, message }) => {
  // Fetching the current user's profile
  const currentUser = useAuthStore((state) => state.profile)

  // Checks if the current user has reacted with a specific emoji
  const hasCurrentUserReacted = useCallback(
    (reactionUsers: Array<{ user_id: string }>) =>
      reactionUsers.some(({ user_id }) => user_id === currentUser?.id),
    [currentUser]
  )

  // Handles the reaction click event
  const handleReactionClick = useCallback(
    (emoji: string) => {
      const isUserReaction = hasCurrentUserReacted(reactions[emoji])
      if (isUserReaction) {
        removeReaction(message, emoji).catch(console.error)
      }
    },
    [reactions, currentUser, message, hasCurrentUserReacted]
  )

  return (
    <div className="relative mr-auto flex w-full scroll-pl-6 flex-row flex-wrap justify-start gap-1 overflow-hidden overflow-x-auto">
      {reactions &&
        Object.entries(reactions).map(([emoji, users]: any, index) => (
          <button
            className={`btn btn-ghost btn-active btn-xs flex h-8 min-w-8 scroll-ms-6 items-center justify-center gap-2 p-0 text-xl  first-of-type:ml-0  ${
              hasCurrentUserReacted(users)
                ? '!bg-secondary '
                : '!bg-gray-200 !bg-opacity-20 !text-opacity-100 !opacity-100'
            } ${users.length >= 2 ? 'px-2' : ''}`}
            key={index}
            onClick={() => handleReactionClick(emoji)}
            disabled={!hasCurrentUserReacted(users)}>
            {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <em-emoji native={emoji} set="native" size="20"></em-emoji>
            }
            {users.length >= 2 ? <div className="badge badge-sm">{users.length}</div> : ''}
          </button>
        ))}
    </div>
  )
}

export default ReactionsCard
