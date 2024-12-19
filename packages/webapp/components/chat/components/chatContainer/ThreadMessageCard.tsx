import React from 'react'
import { TMessageWithUser } from '@api'
import { Avatar } from '@components/ui/Avatar'
import ThreadMessageFooter from './ThreadMessageFooter'
import MessageHeader from './MessageHeader'
import MessageContent from './MessageContent'
import { isOnlyEmoji } from '@utils/index'

type TThreadMessageCardProps = {
  data: TMessageWithUser
}

const ThreadMessageCard = React.forwardRef<HTMLDivElement, TThreadMessageCardProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="msg_card group chat chat-start relative w-full">
        <Avatar
          src={data?.user_details?.avatar_url}
          avatarUpdatedAt={data?.user_details?.avatar_updated_at}
          className="avatar chat-image w-10 cursor-pointer rounded-full transition-all hover:scale-105"
          style={{
            width: 40,
            height: 40,
            cursor: 'pointer'
          }}
          id={data?.user_details?.id}
          alt={`avatar_${data?.user_details?.id}`}
        />
        {isOnlyEmoji(data?.content) ? (
          <div className="w-full">
            <MessageHeader data={{ ...data, isGroupStart: true }} />
            <MessageContent data={data} />
            <ThreadMessageFooter data={data} />
          </div>
        ) : (
          <div className={`chat-bubble flex w-full flex-col`}>
            <MessageHeader data={{ ...data, isGroupStart: true }} />
            <MessageContent data={data} />
            <ThreadMessageFooter data={data} />
          </div>
        )}
      </div>
    )
  }
)

ThreadMessageCard.displayName = 'ThreadMessageCard'

export default ThreadMessageCard
