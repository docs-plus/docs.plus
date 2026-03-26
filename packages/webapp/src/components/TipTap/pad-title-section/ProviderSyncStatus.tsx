import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'
import { useStore } from '@stores'

const ProviderSyncStatus = () => {
  const providerStatus = useStore((state) => state.settings.providerStatus)

  const statusConfig = {
    saving: {
      icon: <Icons.sync className="animate-spin" size={18} />,
      text: 'Saving',
      tooltip: 'Syncing changes to server...',
      className: 'text-base-content/50'
    },
    synced: {
      icon: <Icons.cloudUpload size={18} />,
      text: '',
      tooltip: 'Changes synced to server (visible to collaborators). Saving to database...',
      className: 'text-base-content/50'
    },
    saved: {
      icon: <Icons.cloud size={18} />,
      text: '',
      tooltip: 'All changes saved to database',
      className: 'text-base-content/60'
    },
    online: {
      icon: <Icons.wifi size={18} />,
      text: 'Online',
      tooltip: 'Back online! Reconnecting...',
      className: 'text-success'
    },
    offline: {
      icon: <Icons.wifiOff size={18} />,
      text: 'Offline',
      tooltip: 'You are offline. Changes will sync when you reconnect.',
      className: 'text-warning'
    },
    error: {
      icon: <Icons.cloudOff size={18} />,
      text: 'Error',
      tooltip: 'Connection error. Your changes are saved locally.',
      className: 'text-error'
    }
  }

  const config = statusConfig[providerStatus]

  return (
    <Tooltip title={config.tooltip} placement="bottom">
      <div
        className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${config.className} hover:bg-base-200 cursor-default rounded-md transition-colors`}>
        {config.icon}
        {config.text && <span>{config.text}</span>}
      </div>
    </Tooltip>
  )
}

export default ProviderSyncStatus
