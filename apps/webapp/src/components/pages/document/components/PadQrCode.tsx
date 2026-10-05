import { popoverPanelClassName } from '@components/ui/Popover'
import { usePadShareUrl } from '@hooks/usePadShareUrl'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'

const QrCode = dynamic(() => import('@components/ui/QrCode'), {
  ssr: false,
  loading: () => <div className="skeleton rounded-box size-32" />
})

/** The toolbar's QR card for the pad URL. `DesktopEditor` mounts it only while it is shown. */
export function PadQrCode() {
  const shareUrl = usePadShareUrl()

  // A size container over the pad row, above docked chat. The card shows only where it
  // clears the sheet, its heading chips, chat and the scrollbar. It sits under the Find
  // bar slot (top-2, 46px tall) with the same right edge, so the two never meet.
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-x-0 top-0 bottom-[var(--chat-panel-height,0px)]">
      <div
        role="img"
        aria-label={`QR code for ${shareUrl.replace(/^https?:\/\//, '')}`}
        data-testid="pad-qr-code"
        className={twMerge(
          popoverPanelClassName,
          'absolute top-16 right-[calc(var(--scrollbar-size-thin)+0.5rem)] hidden w-auto [@container_(min-width:80rem)_and_(min-height:13.5rem)]:block'
        )}>
        <QrCode value={shareUrl} className="w-32" />
      </div>
    </div>
  )
}
