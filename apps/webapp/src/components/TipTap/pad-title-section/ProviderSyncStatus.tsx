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
  // The mirror warning renders beside the save state, never in its place.
  mirrorWarning: boolean
}

type PresentationOptions = {
  contentForkError?: boolean
  mirrorWriteFailed?: boolean
}

const MIRROR_WARNING_TEXT = 'No offline copy'
const MIRROR_WARNING_TOOLTIP =
  'This browser stopped saving an offline copy of this document. Your changes still save to the server.'

function statusPresentation(
  status: ProviderStatus,
  options: PresentationOptions = {}
): StatusPresentation {
  return { ...saveStatePresentation(status, options), mirrorWarning: !!options.mirrorWriteFailed }
}

function saveStatePresentation(
  status: ProviderStatus,
  { contentForkError, mirrorWriteFailed }: PresentationOptions
): Omit<StatusPresentation, 'mirrorWarning'> {
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
        tooltip: mirrorWriteFailed
          ? 'You are offline, and this browser cannot save an offline copy. Keep this tab open until you reconnect.'
          : 'You are offline. Changes will sync when you reconnect.',
        className: 'text-warning'
      }
    case 'error':
      // Content-fork freeze is terminal (schema/version mismatch) and only a
      // reload recovers it — never tell the user their changes will still sync.
      if (contentForkError) {
        return {
          icon: <Icons.cloudOff size={18} />,
          text: 'Reload',
          tooltip:
            'This tab is out of date and stopped syncing to protect your work. Reload the page to keep editing.',
          className: 'text-error'
        }
      }
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

// Tooltips never open on touch, so the warning keeps its text when it stands alone.
const MirrorWarning = ({ withText, className }: { withText: boolean; className: string }) => (
  <Tooltip title={MIRROR_WARNING_TOOLTIP} placement="bottom">
    <div
      role="img"
      aria-label={MIRROR_WARNING_TEXT}
      className={`text-warning rounded-field flex cursor-default items-center gap-1.5 text-sm font-medium ${
        withText ? 'hover:bg-base-200 px-3 py-1 transition-colors' : 'px-1 py-1'
      } ${className}`}>
      <Icons.alert size={18} />
      {withText && <span>{MIRROR_WARNING_TEXT}</span>}
    </div>
  </Tooltip>
)

// compact: surfaces with little room (mobile header) hide the healthy save state
// and only raise the chip on error/offline/unauthenticated or a failed mirror.
const ProviderSyncStatus = ({
  compact = false,
  onSignIn = openInlineSignInDialog
}: {
  compact?: boolean
  onSignIn?: () => void
}) => {
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const contentForkError = useStore((state) => state.settings.contentForkError)
  const mirrorWriteFailed = useStore((state) => state.settings.mirrorWriteFailed)

  const disconnected = isProviderDisconnected(providerStatus)
  const config = statusPresentation(providerStatus, { contentForkError, mirrorWriteFailed })

  if (compact && !disconnected && !config.mirrorWarning) return null

  // Opacity-only entry tier: the mobile chip lives in the sticky header, which
  // rides the visualViewport machinery — never use transform-based animations here.
  const entryClassName = compact ? 'motion-safe:animate-[doc-content-in_120ms_ease-out_both]' : ''

  if (compact && !disconnected) {
    return <MirrorWarning withText className={entryClassName} />
  }

  const warning = config.mirrorWarning ? (
    <MirrorWarning withText={false} className={entryClassName} />
  ) : null

  // First-sync window (S1–S2): the shell is real but the document hasn't arrived yet.
  if (providerSyncing && !disconnected && !compact) {
    return (
      <>
        <Tooltip title="Loading the latest version of this document…" placement="bottom">
          <div className="text-base-content/50 hover:bg-base-200 rounded-field flex cursor-default items-center gap-1.5 px-3 py-1 text-sm font-medium transition-colors">
            <Icons.sync className="animate-spin" size={18} />
            <span>Connecting</span>
          </div>
        </Tooltip>
        {warning}
      </>
    )
  }

  const chipClassName = `flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${config.className} hover:bg-base-200 rounded-field transition-colors ${entryClassName}`

  if (providerStatus === 'unauthenticated') {
    return (
      <>
        <Tooltip title={config.tooltip} placement="bottom">
          <button type="button" onClick={onSignIn} className={`${chipClassName} cursor-pointer`}>
            {config.icon}
            <span>{config.text}</span>
          </button>
        </Tooltip>
        {warning}
      </>
    )
  }

  return (
    <>
      <Tooltip title={config.tooltip} placement="bottom">
        <div
          role="status"
          aria-label={config.text || config.tooltip}
          className={`${chipClassName} cursor-default`}>
          {config.icon}
          {config.text && <span>{config.text}</span>}
        </div>
      </Tooltip>
      {warning}
    </>
  )
}

export default ProviderSyncStatus
