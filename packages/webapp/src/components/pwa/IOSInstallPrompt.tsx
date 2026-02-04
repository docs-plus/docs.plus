/**
 * iOS PWA Install Prompt
 *
 * Shows instructions for iOS users to add the PWA to their home screen.
 * Required for push notifications to work on iOS (16.4+).
 */
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useState } from 'react'
import { LuShare, LuSquarePlus, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

const STORAGE_KEY = 'ios-install-prompt-dismissed'
const SNOOZED_UNTIL_KEY = 'ios-install-prompt-snoozed-until'
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_IOS_INSTALL_EVENT = 'show-ios-install-prompt'

export function showIOSInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_IOS_INSTALL_EVENT))
  }
}

interface IOSInstallPromptProps {
  className?: string
  autoShow?: boolean
  autoShowDelay?: number
}

export function IOSInstallPrompt({
  className,
  autoShow = false,
  autoShowDelay = 5000
}: IOSInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  const canShow = useCallback(() => {
    if (!profile) return false
    if (platform !== 'ios') return false
    if (isPWAInstalled) return false
    if (!iosSupportsWebPush) return false

    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === 'permanent') return false

    const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return false

    return true
  }, [profile, platform, isPWAInstalled, iosSupportsWebPush])

  const show = useCallback(() => {
    if (!canShow()) return
    setIsVisible(true)
    requestAnimationFrame(() => setIsAnimating(true))
  }, [canShow])

  const hide = useCallback((permanent = false) => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      if (permanent) localStorage.setItem(STORAGE_KEY, 'permanent')
    }, 300)
  }, [])

  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  const handleClose = () => hide(true)

  useEffect(() => {
    if (!autoShow || !canShow()) return
    const timeout = setTimeout(show, autoShowDelay)
    return () => clearTimeout(timeout)
  }, [autoShow, autoShowDelay, canShow, show])

  useEffect(() => {
    const handler = () => show()
    window.addEventListener(SHOW_IOS_INSTALL_EVENT, handler)
    return () => window.removeEventListener(SHOW_IOS_INSTALL_EVENT, handler)
  }, [show])

  useEffect(() => {
    if (isPWAInstalled && isVisible) hide(true)
  }, [isPWAInstalled, isVisible, hide])

  if (!isVisible) return null

  return (
    <div
      className={twMerge(
        'fixed right-4 bottom-6 left-4 z-50 mx-auto max-w-md',
        'transform transition-all duration-300 ease-out',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          'flex flex-col gap-4 rounded-2xl px-5 py-4',
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          'border-base-content/10 border shadow-xl'
        )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-xl p-2">
              <LuSquarePlus size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Add to Home Screen</h3>
              <p className="text-xs opacity-60">Enable push notifications on iOS</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-base-content/10 -mt-1 -mr-2 cursor-pointer rounded-lg p-1.5 opacity-60 transition-all hover:opacity-100"
            aria-label="Dismiss">
            <LuX size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              1
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Tap</span>
              <LuShare size={18} className="text-primary" />
              <span className="opacity-70">in Safari toolbar</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              2
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Select</span>
              <LuSquarePlus size={18} className="text-primary" />
              <span className="font-medium">&quot;Add to Home Screen&quot;</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              3
            </div>
            <span className="text-sm">Open from Home Screen to get notifications</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleLater}
            className="hover:bg-base-content/10 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium opacity-70 transition-all hover:opacity-100">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}

export default IOSInstallPrompt
