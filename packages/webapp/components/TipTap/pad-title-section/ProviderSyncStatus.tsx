import { useStore } from '@stores'
import { MdSync, MdCloudDone, MdCloudOff, MdCloudQueue } from 'react-icons/md'
import { Tooltip } from '@components/ui/Tooltip'

const ProviderSyncStatus = () => {
  const { providerStatus } = useStore((state) => state.settings)

  const statusConfig = {
    saving: {
      icon: <MdSync className="animate-spin" size={18} />,
      text: 'Saving...',
      tooltip: 'Saving changes...',
      className: 'text-gray-500'
    },
    synced: {
      icon: <MdCloudQueue size={18} />,
      text: '',
      tooltip: 'All changes synced to server and can be seen by other users',
      className: 'text-gray-500'
    },
    saved: {
      icon: <MdCloudDone size={18} />,
      text: '',
      tooltip: 'All changes saved to database',
      className: 'text-gray-600'
    },
    error: {
      icon: <MdCloudOff size={18} />,
      text: 'Error',
      tooltip: 'Error syncing changes. Check your connection.',
      className: 'text-red-500'
    }
  }

  const config = statusConfig[providerStatus]

  return (
    <Tooltip title={config.tooltip} placement="bottom">
      <div
        className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${config.className} cursor-default rounded-md transition-colors hover:bg-gray-100`}>
        {config.icon}
        {config.text && <span>{config.text}</span>}
      </div>
    </Tooltip>
  )
}

export default ProviderSyncStatus
