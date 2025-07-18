import { Avatar } from '@components/ui/Avatar'
import { MdGroups } from 'react-icons/md'

const MentionItem = ({ item, index, selectedIndex, onSelect }: any) => (
  <div key={item.id} className="mention-item">
    <button
      className={`flex w-full items-center p-2 hover:bg-gray-100 ${
        index === selectedIndex ? '!ring-primary/50 bg-gray-100 !ring-1' : ''
      }`}
      onClick={() => onSelect(index)}>
      {item.isEveryoneOption ? (
        <MdGroups className="mr-2 size-8 text-gray-600" />
      ) : (
        <Avatar
          id={item.id}
          src={item.avatar_url || ''}
          avatarUpdatedAt={item.avatar_updated_at || null}
          alt={item.full_name || item.display_name || item.username}
          data-tip={item.display_name || 'anonymous'}
          size="sm"
          className="mr-2 size-8"
        />
      )}
      <span className="flex flex-col justify-start text-sm">
        <span className={`font-medium ${index === selectedIndex ? 'text-primary' : ''}`}>
          {item.full_name || item.username}
        </span>
        <span className="text-xs text-gray-600">@{item.username}</span>
      </span>
    </button>
    {index === 0 && <div className="divider m-0 h-2 p-0" />}
  </div>
)

export default MentionItem
