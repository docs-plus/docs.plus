import React from 'react'
import { useAuthStore } from '@stores'
import { removeReaction } from '@api'
import MessageReaction from '@components/chat/MessageReaction'

interface ReactionsCardProps {
  reactions: { [emoji: string]: Array<{ user_id: string }> }
  message: any
  children?: React.ReactNode
  showReactionBtn?: boolean
}

const ReactionsCard: React.FC<ReactionsCardProps> = ({
  reactions,
  message,
  children,
  showReactionBtn = true
}) => {
  const currentUser = useAuthStore((state) => state.profile)

  const isUserReaction = (users: Array<{ user_id: string }>) =>
    users.some(({ user_id }) => user_id === currentUser?.id)

  const handleReactionClick = (emoji: string) => {
    if (isUserReaction(reactions[emoji])) {
      removeReaction(message, emoji).catch(console.error)
    }
  }

  return (
    <>
      <div className="relative mr-auto flex w-full scroll-pl-6 flex-row flex-wrap justify-start gap-0.5 overflow-hidden overflow-x-auto">
        {Object.entries(reactions || {}).map(([emoji, users]: [string, any], index) => {
          const currentUserReacted = isUserReaction(users)
          return (
            <span
              className={`badge bg-base-300 relative flex items-center justify-center gap-0 !p-0 ${currentUserReacted ? 'border-docsy cursor-pointer border-1' : 'cursor-default'}`}
              key={index}
              onClick={() => handleReactionClick(emoji)}>
              {/* @ts-ignore */}
              <em-emoji native={emoji} set="native" size={18} className="flex-shrink-0 pl-[4px]" />
              {users.length >= 1 && (
                <div className="badge badge-xs border-none !bg-transparent !font-mono">
                  {users.length}
                </div>
              )}
            </span>
          )
        })}

        {(showReactionBtn || Object.keys(reactions || {}).length > 0) && (
          <MessageReaction message={message} />
        )}

        <div className="mt-auto ml-auto flex justify-end">{children}</div>
      </div>
    </>
  )
}

export default ReactionsCard
