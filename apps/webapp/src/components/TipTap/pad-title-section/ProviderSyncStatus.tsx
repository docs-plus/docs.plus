import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { ProviderStatus } from '@types'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { getNeedsAuthCopy, isProviderDisconnected } from '@utils/providerCollabStatus'
import type { ReactNode } from 'react'

type StatusPresentation = {
  icon: ReactNode
  text: string
  tooltip: string
  className: string
}

function statusPresentation(status: ProviderStatus): StatusPresentation {
  switch (status) {
    case 'saving':
      return {
        icon: <Icons.sync className="animate-spin" size={18} />,
        text: '',
        tooltip: 'Syncing changes to server...',
        className: 'text-base-content/50'
      }
    case 'synced':
      return {
        icon: <Icons.cloudUpload size={18} />,
        text: '',
        tooltip: 'Changes synced to server (visible to collaborators). Finishing save…',
        className: 'text-base-content/50'
      }
    case 'saved':
      return {
        icon: <Icons.cloud size={18} />,
        text: '',
        tooltip: 'All changes saved',
        className: 'text-base-content/60'
      }
    case 'offline':
      return {
        icon: <Icons.wifiOff size={18} />,
        text: 'Offline',
        tooltip: 'You are offline. Changes will sync when you reconnect.',
        className: 'text-warning'
      }
    case 'error':
      return {
        icon: <Icons.cloudOff size={18} />,
        text: 'Error',
        tooltip: "Changes will sync when the connection is restored — don't close the tab",
        className: 'text-error'
      }
    case 'unauthenticated': {
      const { chip, tooltip } = getNeedsAuthCopy()
      return {
        icon: <Icons.cloudOff size={18} />,
        text: chip,
        tooltip,
        className: 'text-warning'
      }
    }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

// disconnectedOnly: compact surfaces (mobile header) show nothing while healthy
// and only raise the chip on error/offline/unauthenticated.
const ProviderSyncStatus = ({
  disconnectedOnly = false,
  onSignIn = openInlineSignInDialog
}: {
  disconnectedOnly?: boolean
  onSignIn?: () => void
}) => {
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)

  const disconnected = isProviderDisconnected(providerStatus)

  if (disconnectedOnly && !disconnected) return null

  // First-sync window (S1–S2): the shell is real but the document hasn't arrived yet.
  if (providerSyncing && !disconnected) {
    return (
      <Tooltip title="Loading the latest version of this document…" placement="bottom">
        <div className="text-base-content/50 hover:bg-base-200 flex cursor-default items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors">
          <Icons.sync className="animate-spin" size={18} />
          <span>Connecting</span>
        </div>
      </Tooltip>
    )
  }

  const config = statusPresentation(providerStatus)
  // Opacity-only entry tier: the mobile chip lives in the sticky header, which
  // rides the visualViewport machinery — never use transform-based animations here.
  const chipClassName = `flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${config.className} hover:bg-base-200 rounded-md transition-colors ${
    disconnectedOnly ? 'motion-safe:animate-[doc-content-in_120ms_ease-out_both]' : ''
  }`

  if (providerStatus === 'unauthenticated') {
    return (
      <Tooltip title={config.tooltip} placement="bottom">
        <button type="button" onClick={onSignIn} className={`${chipClassName} cursor-pointer`}>
          {config.icon}
          <span>{config.text}</span>
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={config.tooltip} placement="bottom">
      <div
        role="status"
        aria-label={config.text || config.tooltip}
        className={`${chipClassName} cursor-default`}>
        {config.icon}
        {config.text && <span>{config.text}</span>}
      </div>
    </Tooltip>
  )
}

export default ProviderSyncStatus
