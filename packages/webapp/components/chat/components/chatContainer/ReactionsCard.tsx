import React from 'react'
import { useAuthStore } from '@stores'
import { removeReaction } from '@api'
import MessageReaction from '@components/chat/MessageReaction'

interface ReactionsCardProps {
  reactions: { [emoji: string]: Array<{ user_id: string }> }
  message: any
  children?: React.ReactNode
}

const ReactionsCard: React.FC<ReactionsCardProps> = ({ reactions, message, children }) => {
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
          const hasReacted = isUserReaction(users)
          return (
            <button
              className={`btn ${users.length <= 1 ? 'btn-square h-8 w-8' : 'h-8 px-2'} ${hasReacted ? 'bg-indigo-600' : 'bg-slate-800'} relative flex items-center justify-center border-none p-0 text-xl`}
              key={index}
              onClick={() => handleReactionClick(emoji)}>
              {/* @ts-ignore */}
              <em-emoji native={emoji} set="native" size={20} className="flex-shrink-0"></em-emoji>
              {users.length >= 2 && <div className="badge badge-xs">{users.length}</div>}
            </button>
          )
        })}

        <MessageReaction message={message} />

        <div className="mt-auto ml-auto flex justify-end">{children}</div>
      </div>
    </>
  )
}

export default ReactionsCard
