/**
 * PWA Install Prompt
 *
 * Unified PWA installation prompt that handles:
 * - Android: Native browser install prompt (beforeinstallprompt)
 * - iOS: Custom "Add to Home Screen" instructions
 * - Desktop: Native browser install prompt
 *
 * Design: Matches NotificationPromptCard style for consistency.
 */
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuDownload, LuShare, LuSmartphone, LuSquarePlus, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

// Storage keys
const STORAGE_KEY = 'pwa-install-prompt-dismissed'
const SNOOZED_UNTIL_KEY = 'pwa-install-prompt-snoozed-until'

// Snooze duration (7 days)
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000

// Event for triggering the prompt
const SHOW_PWA_INSTALL_EVENT = 'show-pwa-install-prompt'

/**
 * Programmatically show the PWA install prompt
 */
export function showPWAInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PWA_INSTALL_EVENT))
  }
}

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Hook for managing PWA installation
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const { platform, isPWAInstalled } = usePlatformDetection()

  // Capture the beforeinstallprompt event (Android/Desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if already installed
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mediaQuery.matches || isPWAInstalled)

    const handleChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches)
    }

    mediaQuery.addEventListener?.('change', handleChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      mediaQuery.removeEventListener?.('change', handleChange)
    }
  }, [isPWAInstalled])

  // Trigger native install prompt (Android/Desktop)
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome === 'accepted'
    } catch {
      return false
    }
  }, [deferredPrompt])

  return {
    canInstall: deferredPrompt !== null || (platform === 'ios' && !isInstalled),
    canNativeInstall: deferredPrompt !== null,
    isInstalled,
    install,
    platform
  }
}

interface PWAInstallPromptProps {
  className?: string
  /** Auto-show after delay (default: false) */
  autoShow?: boolean
  /** Delay before auto-showing in ms (default: 10000) */
  autoShowDelay?: number
}

export function PWAInstallPrompt({
  className,
  autoShow = false,
  autoShowDelay = 10000
}: PWAInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()
  const { canInstall, canNativeInstall, install, isInstalled } = usePWAInstall()
  const hasShownRef = useRef(false)

  // Check if we should show the prompt
  const canShow = useCallback(() => {
    // Must be logged in
    if (!profile) return false

    // Already installed
    if (isInstalled || isPWAInstalled) return false

    // Can't install
    if (!canInstall) return false

    // iOS: Only show if iOS 16.4+ (supports web push)
    if (platform === 'ios' && !iosSupportsWebPush) return false

    // Check if permanently dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === 'permanent') return false

    // Check if snoozed
    const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return false

    return true
  }, [profile, isInstalled, isPWAInstalled, canInstall, platform, iosSupportsWebPush])

  // Show with animation
  const show = useCallback(() => {
    if (!canShow() || hasShownRef.current) return
    hasShownRef.current = true
    setIsVisible(true)
    requestAnimationFrame(() => setIsAnimating(true))
  }, [canShow])

  // Hide with animation
  const hide = useCallback((permanent = false) => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      setShowIOSInstructions(false)
      if (permanent) {
        localStorage.setItem(STORAGE_KEY, 'permanent')
      }
    }, 300)
  }, [])

  // Handle install button click
  const handleInstall = async () => {
    if (platform === 'ios') {
      // Show iOS instructions
      setShowIOSInstructions(true)
    } else if (canNativeInstall) {
      // Trigger native install prompt (Android/Desktop)
      const installed = await install()
      if (installed) {
        hide(true)
      }
    }
  }

  // Handle "Later" - snooze for 7 days
  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  // Handle close (permanent dismiss)
  const handleClose = () => {
    hide(true)
  }

  // Auto-show after delay
  useEffect(() => {
    if (!autoShow || !canShow()) return

    const timeout = setTimeout(show, autoShowDelay)
    return () => clearTimeout(timeout)
  }, [autoShow, autoShowDelay, canShow, show])

  // Listen for external show event
  useEffect(() => {
    const handler = () => {
      hasShownRef.current = false
      show()
    }
    window.addEventListener(SHOW_PWA_INSTALL_EVENT, handler)
    return () => window.removeEventListener(SHOW_PWA_INSTALL_EVENT, handler)
  }, [show])

  // Hide when installed
  useEffect(() => {
    if (isInstalled && isVisible) {
      hide(true)
    }
  }, [isInstalled, isVisible, hide])

  if (!isVisible) return null

  return (
    <div
      className={twMerge(
        // Position: bottom-center
        'fixed right-4 bottom-6 left-4 z-50 mx-auto max-w-md',
        // Animation
        'transform transition-all duration-300 ease-out',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          // Match toast design system
          'flex flex-col gap-4 rounded-2xl px-5 py-4',
          // Theme-aware background
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          // Depth
          'shadow-xl',
          // Border
          'border-base-content/10 border'
        )}>
        {showIOSInstructions ? (
          // iOS Instructions View
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-xl p-2">
                  <LuSquarePlus size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Add to Home Screen</h3>
                  <p className="text-xs opacity-60">Follow these steps</p>
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
                  <span className="font-medium">"Add to Home Screen"</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  3
                </div>
                <span className="text-sm">Open from Home Screen</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-primary cursor-pointer text-sm font-medium hover:underline">
                Back
              </button>
            </div>
          </>
        ) : (
          // Main Install View
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-xl p-2">
                  <LuSmartphone size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Install Docs.plus</h3>
                  <p className="text-xs opacity-60">Get the best experience</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="hover:bg-base-content/10 -mt-1 -mr-2 cursor-pointer rounded-lg p-1.5 opacity-60 transition-all hover:opacity-100"
                aria-label="Dismiss">
                <LuX size={16} />
              </button>
            </div>

            <ul className="flex flex-col gap-2 text-sm opacity-80">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Push notifications when you get messages</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Faster loading and offline access</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Quick access from your home screen</span>
              </li>
            </ul>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={handleLater}
                className="hover:bg-base-content/10 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium opacity-70 transition-all hover:opacity-100">
                Maybe Later
              </button>
              <button
                onClick={handleInstall}
                className="bg-primary hover:bg-primary/90 text-primary-content flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors">
                <LuDownload size={16} />
                Install
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PWAInstallPrompt
