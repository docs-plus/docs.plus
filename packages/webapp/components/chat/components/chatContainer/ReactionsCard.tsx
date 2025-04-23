import React from 'react'
import { useAuthStore } from '@stores'
import { removeReaction } from '@api'

interface ReactionsCardProps {
  reactions: { [emoji: string]: Array<{ user_id: string }> }
  message: any
}

const ReactionsCard: React.FC<ReactionsCardProps> = ({ reactions, message }) => {
  const currentUser = useAuthStore((state) => state.profile)

  const isUserReaction = (users: Array<{ user_id: string }>) =>
    users.some(({ user_id }) => user_id === currentUser?.id)

  const handleReactionClick = (emoji: string) => {
    if (isUserReaction(reactions[emoji])) {
      removeReaction(message, emoji).catch(console.error)
    }
  }

  return (
    <div className="relative mr-auto flex w-full scroll-pl-6 flex-row flex-wrap justify-start gap-1 overflow-hidden overflow-x-auto">
      {Object.entries(reactions || {}).map(([emoji, users]: [string, any], index) => {
        const hasReacted = isUserReaction(users)
        return (
          <button
            className={`btn btn-square btn-ghost btn-xs flex items-center justify-center gap-2 border-none bg-stone-400/40 p-4 text-xl first-of-type:ml-0 ${
              hasReacted
                ? 'bg-neutral'
                : '!bg-opacity-20 !text-opacity-100 !bg-gray-200 !opacity-100'
            } ${users.length >= 2 ? 'px-2' : ''}`}
            key={index}
            onClick={() => handleReactionClick(emoji)}
            disabled={!hasReacted}>
            {/* @ts-ignore */}
            <em-emoji native={emoji} set="native" size="20" className="size-6"></em-emoji>
            {users.length >= 2 && <div className="badge badge-sm">{users.length}</div>}
          </button>
        )
      })}
    </div>
  )
}

export default ReactionsCard
