import { popoverPanelClassName } from '@components/ui/Popover'
import { QrVeil } from '@components/ui/QrVeil'
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

  // A size container over the pad row, above docked chat, so the card never runs into chat (#377).
  // Worst case is Find open: a 68px top + 2px border + 14px gap = 5.25rem. So the small card
  // needs 13.25rem, and the large code caps at 100cqh - 5.25rem. It may cover the page edge.
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-x-0 top-0 bottom-[var(--chat-panel-height,0px)]">
      <div
        data-testid="pad-qr-code"
        className="pointer-events-auto absolute top-3.5 right-[calc(var(--scrollbar-size-thin)+0.875rem)] z-50 hidden group-has-[.caret-find-bar]/padcol:top-17 [@container_(min-height:13.5rem)]:block">
        <div
          role="img"
          aria-label={`QR code for ${shareUrl.replace(/^https?:\/\//, '')}`}
          className={twMerge(popoverPanelClassName, 'w-auto')}>
          <QrCode
            value={shareUrl}
            className={twMerge(
              'motion-safe:transition-[width] motion-safe:duration-[var(--motion-panel)] motion-safe:ease-out',
              isLarge ? 'w-[clamp(8rem,calc(100cqh-5.25rem),16rem)]' : 'w-32'
            )}
          />
        </div>
        <button
          type="button"
          data-testid="pad-qr-size"
          aria-label="Large QR code"
          aria-pressed={isLarge}
          onClick={() => setIsLarge((large) => !large)}
          className="group/qr-veil rounded-box focus-visible:ring-primary absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:outline-none">
          <QrVeil icon={isLarge ? Icons.minimize2 : Icons.maximize2} />
        </button>
      </div>
    </div>
  )
}
