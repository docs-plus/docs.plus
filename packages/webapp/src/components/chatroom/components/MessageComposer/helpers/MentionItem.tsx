import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { MdGroups } from 'react-icons/md'

const MentionItem = ({ item, index, selectedIndex, onSelect }: any) => (
  <div key={item.id} className="mention-item">
    <Button
      variant="ghost"
      className={`hover:bg-base-200 flex w-full items-center justify-start p-2 ${
        index === selectedIndex ? '!ring-primary/50 bg-base-200 !ring-1' : ''
      }`}
      onClick={() => onSelect(index)}>
      {item.isEveryoneOption ? (
        <MdGroups className="text-base-content/70 mr-2 size-8" />
      ) : (
        <Avatar
          id={item.id}
          src={item.avatar_url || ''}
          avatarUpdatedAt={item.avatar_updated_at || null}
          alt={item.full_name || item.display_name || item.username}
          data-tip={item.display_name || 'anonymous'}
          className="mr-2 size-8"
        />
      )}
      <span className="flex flex-col justify-start text-sm">
        <span className={`font-medium ${index === selectedIndex ? 'text-primary' : ''}`}>
          {item.full_name || item.username}
        </span>
        <span className="text-base-content/70 text-xs">@{item.username}</span>
      </span>
    </Button>
    {index === 0 && <div className="divider m-0 h-2 p-0" />}
  </div>
)

export default MentionItem
