import type { IconType } from 'react-icons'

interface QrVeilProps {
  icon: IconType
}

/**
 * The veil and round button over a QR code button. The host button carries `group/qr-veil`.
 * It shows on hover and keyboard focus only, so at rest nothing covers the code and it scans.
 */
export function QrVeil({ icon: Icon }: QrVeilProps) {
  return (
    <span
      aria-hidden
      data-testid="qr-veil"
      className="rounded-box absolute inset-0 flex items-center justify-center bg-[var(--qr-plate)]/30 opacity-0 backdrop-blur-[3px] transition-opacity duration-[var(--motion-overlay-in)] group-hover/qr-veil:opacity-100 group-focus-visible/qr-veil:opacity-100">
      <span className="flex size-12 scale-90 items-center justify-center rounded-full bg-[var(--qr-ink)] text-[var(--qr-plate)] shadow-xl transition-transform duration-[var(--motion-overlay-in)] ease-out group-hover/qr-veil:scale-100 group-focus-visible/qr-veil:scale-100 group-active/qr-veil:scale-95 motion-reduce:transition-none">
        <Icon size={22} />
      </span>
    </span>
  )
}

export default QrVeil
