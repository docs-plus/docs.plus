import { TMsgRow } from '@types'
import { Avatar } from '@components/ui/Avatar'

export const ProfilePic = ({ message }: { message: TMsgRow }) => {
  const isGroupStart = message.isGroupStart

  return (
    <div className={`avatar ${isGroupStart ? 'block' : 'hidden'}`}>
      <Avatar
        src={message?.user_details?.avatar_url}
        avatarUpdatedAt={message?.user_details?.avatar_updated_at}
        className="avatar w-10 cursor-pointer rounded-full"
        style={{
          width: 40,
          height: 40,
          cursour: 'pointer'
        }}
        id={message?.user_details?.id}
        alt={`avatar_${message?.user_details?.id}`}
      />
    </div>
  )
}
