import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { QrVeil } from '@components/ui/QrVeil'
import { Icons } from '@icons'
import { isLightTheme, useThemeStore } from '@stores'
import dynamic from 'next/dynamic'
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react'

// A projector in a dark room needs a dark screen. The high-contrast theme is tuned for projection.
const PRESENT_THEMES = { light: 'docsplus', dark: 'docsplus-dark-hc' } as const
const ICON_SIZE = 20

const QrCode = dynamic(() => import('@components/ui/QrCode'), {
  ssr: false,
  loading: () => <div className="skeleton rounded-box aspect-square w-full" />
})

interface PresentQrCodeProps {
  value: string
  title: string
}

/** The share QR, which is also the trigger for its own full-screen Present view. */
export function PresentQrCode({ value, title }: PresentQrCodeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const displayUrl = value.replace(/^https?:\/\//, '')
  const appIsLight = useThemeStore((state) => isLightTheme(state.resolvedTheme))
  const [isDark, setIsDark] = useState(!appIsLight)

  useEffect(() => {
    const dialog = dialogRef.current
    // In browser full screen the first Esc never reaches the page; close Present with it.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && dialog?.open) dialog.close()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const open = () => {
    dialogRef.current?.showModal()
    stageRef.current?.requestFullscreen?.().catch(() => {})
  }

  const close = () => dialogRef.current?.close()

  // Leaving full screen drops focus to <body>, so restore it after the exit settles.
  const handleClosed = () => {
    const restoreFocus = () => triggerRef.current?.focus()
    if (document.fullscreenElement) document.exitFullscreen().then(restoreFocus, restoreFocus)
    else restoreFocus()
  }

  // Esc closes Present only; the share dialog's own dismiss must not see it.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') event.stopPropagation()
  }

  const handleStageClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) close()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label={`Present QR code for ${displayUrl}`}
        className="group/qr-veil rounded-box focus-visible:ring-primary relative block w-full cursor-pointer focus-visible:ring-2 focus-visible:outline-none max-sm:mx-auto max-sm:max-w-56">
        <QrCode value={value} quietZone={2} className="rounded-box w-full" />
        <QrVeil icon={Icons.fullscreen} />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="share-present-title"
        data-theme={isDark ? PRESENT_THEMES.dark : PRESENT_THEMES.light}
        onClose={handleClosed}
        onKeyDown={handleKeyDown}
        className={`bg-base-100 text-base-content backdrop:bg-base-100 m-0 h-dvh max-h-none w-dvw max-w-none border-0 p-0 open:motion-safe:animate-[doc-content-in_180ms_ease-out_both] ${isDark ? '[--qr-plate:var(--qr-plate-dim)]' : ''}`}>
        <div
          ref={stageRef}
          onClick={handleStageClick}
          className="bg-base-100 relative grid h-full w-full items-center justify-items-center gap-[5vh] px-[5vw] py-[5vh] text-center md:grid-cols-[auto_minmax(0,1fr)] md:justify-items-start md:gap-[5vw] md:text-left">
          <QrCode value={value} className="rounded-box w-[min(80vw,55vh)] md:w-[min(86vh,52vw)]" />
          <div className="grid min-w-0 gap-[2.4vh]">
            <p className="text-base-content/60 text-[clamp(0.75rem,1.6vh,1.25rem)] font-semibold tracking-wide uppercase">
              Scan to open on your phone
            </p>
            <h2
              id="share-present-title"
              className="text-[clamp(1.5rem,5vh,4rem)] leading-tight font-bold text-balance">
              {title}
            </h2>
            <p className="text-base-content text-[clamp(1.25rem,4.6vh,3.5rem)] leading-tight font-bold break-all">
              {displayUrl}
            </p>
            <p className="text-base-content/70 text-[clamp(0.875rem,1.8vh,1.375rem)]">
              Point your camera at the code, or type the link.
            </p>
          </div>
          {/* One recipe for both controls: CloseButton's ghost square, 20px glyphs. */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="md"
              shape="square"
              onClick={() => setIsDark((dark) => !dark)}
              aria-label={isDark ? 'Use a light background' : 'Use a dark background'}
              className="text-base-content/70 hover:text-base-content focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none">
              <span className={`swap swap-rotate ${isDark ? 'swap-active' : ''}`} aria-hidden>
                <Icons.sun size={ICON_SIZE} className="swap-on" />
                <Icons.moon size={ICON_SIZE} className="swap-off" />
              </span>
            </Button>
            <CloseButton
              onClick={close}
              size="md"
              iconSize={ICON_SIZE}
              aria-label="Close Present view"
            />
          </div>
        </div>
      </dialog>
    </>
  )
}

export default PresentQrCode
