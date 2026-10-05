import { popoverPanelClassName } from '@components/ui/Popover'
import { Tooltip } from '@components/ui/Tooltip'
import { usePadShareUrl } from '@hooks/usePadShareUrl'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const QrCode = dynamic(() => import('@components/ui/QrCode'), {
  ssr: false,
  loading: () => <div className="skeleton rounded-box size-32" />
})

/** The toolbar's QR card for the pad URL. `DesktopEditor` mounts it only while it is shown. */
export function PadQrCode() {
  const shareUrl = usePadShareUrl()
  // Session-only: hiding the card unmounts it, so the next show starts small again.
  const [isLarge, setIsLarge] = useState(false)
  const SizeIcon = isLarge ? Icons.minimize2 : Icons.maximize2

  // A size container over the pad row, above docked chat: the card hides only when the row is
  // too short to clear chat. On a narrow window it may cover the page edge (ruling #377).
  // It sits 14px under the toolbar, and drops below the Find bar while Find is open.
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-x-0 top-0 bottom-[var(--chat-panel-height,0px)]">
      <div
        data-testid="pad-qr-code"
        className="group/qr pointer-events-auto absolute top-3.5 right-[calc(var(--scrollbar-size-thin)+0.875rem)] z-50 hidden group-has-[[data-testid=caret-find-bar]]/padcol:top-17 [@container_(min-height:13.5rem)]:block">
        <div
          role="img"
          aria-label={`QR code for ${shareUrl.replace(/^https?:\/\//, '')}`}
          className={twMerge(popoverPanelClassName, 'w-auto')}>
          <QrCode
            value={shareUrl}
            className={twMerge(
              'motion-safe:transition-[width] motion-safe:duration-[var(--motion-panel)] motion-safe:ease-out',
              isLarge ? 'w-64' : 'w-32'
            )}
          />
        </div>
        {/* Hover-only, like the share card's Present chip, so nothing covers the code at rest. */}
        <Tooltip title={isLarge ? 'Smaller QR code' : 'Larger QR code'} placement="left">
          <button
            type="button"
            data-testid="pad-qr-size"
            aria-label="Large QR code"
            aria-pressed={isLarge}
            onClick={() => setIsLarge((large) => !large)}
            className="focus-visible:ring-primary absolute -top-2.5 -left-2.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-[var(--qr-ink)] text-[var(--qr-plate)] opacity-0 shadow-xl transition-opacity duration-[var(--motion-overlay-in)] group-hover/qr:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none">
            <SizeIcon size={14} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
