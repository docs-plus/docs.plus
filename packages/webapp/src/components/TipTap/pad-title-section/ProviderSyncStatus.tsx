import { Tooltip } from '@components/ui/Tooltip'
import { useStore } from '@stores'
import { MdCloudDone, MdCloudOff, MdCloudQueue, MdSync, MdWifi, MdWifiOff } from 'react-icons/md'

const ProviderSyncStatus = () => {
  const { providerStatus } = useStore((state) => state.settings)

  const statusConfig = {
    saving: {
      icon: <MdSync className="animate-spin" size={18} />,
      text: 'Saving',
      tooltip: 'Syncing changes to server...',
      className: 'text-gray-500'
    },
    synced: {
      icon: <MdCloudQueue size={18} />,
      text: '',
      tooltip: 'Changes synced to server (visible to collaborators). Saving to database...',
      className: 'text-gray-500'
    },
    saved: {
      icon: <MdCloudDone size={18} />,
      text: '',
      tooltip: 'All changes saved to database',
      className: 'text-gray-600'
    },
    online: {
      icon: <MdWifi size={18} />,
      text: 'Online',
      tooltip: 'Back online! Reconnecting...',
      className: 'text-green-600'
    },
    offline: {
      icon: <MdWifiOff size={18} />,
      text: 'Offline',
      tooltip: 'You are offline. Changes will sync when you reconnect.',
      className: 'text-orange-500'
    },
    error: {
      icon: <MdCloudOff size={18} />,
      text: 'Error',
      tooltip: 'Connection error. Your changes are saved locally.',
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
