/**
 * Defers `beforeinstallprompt` for our own engagement-gated UI (web.dev/promote-install).
 * Safari fires no such event, so iOS gets a manual Add-to-Home-Screen path instead.
 */
import { useEntryExitTransition } from '@hooks/useEntryExitTransition'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { useAuthStore } from '@stores'
import { trackEvent } from '@utils/analytics'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuDownload, LuShare, LuSmartphone, LuSquarePlus, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

const STORAGE_PREFIX = 'pwa-install'
const DISMISSED_KEY = `${STORAGE_PREFIX}-dismissed`
const SNOOZED_UNTIL_KEY = `${STORAGE_PREFIX}-snoozed-until`
const PROMPT_COUNT_KEY = `${STORAGE_PREFIX}-prompt-count`
const SESSION_COUNT_KEY = `${STORAGE_PREFIX}-session-count`

const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PROMPT_COUNT = 3
const ENGAGEMENT_DELAY_MS = 30_000
const MIN_SESSION_COUNT = 2

const SHOW_PWA_INSTALL_EVENT = 'show-pwa-install-prompt'

/** Call when an action needs the PWA (enabling push on iOS); skips the engagement wait. */
export function showPWAInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PWA_INSTALL_EVENT))
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const { platform, isPWAInstalled } = usePlatformDetection()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstall = (e: Event) => {
      // Prevent Chrome's default mini-infobar — we show our own UI
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      trackEvent('pwa_install')
      setIsInstalled(true)
      setDeferredPrompt(null)
      localStorage.setItem(DISMISSED_KEY, 'permanent')
      localStorage.removeItem(SNOOZED_UNTIL_KEY)
      localStorage.removeItem(PROMPT_COUNT_KEY)
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mediaQuery.matches || isPWAInstalled)

    const handleDisplayChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    mediaQuery.addEventListener?.('change', handleDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener?.('change', handleDisplayChange)
    }
  }, [isPWAInstalled])

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)

      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, 'permanent')
      }

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
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const { mounted, shown, show: showCard, hide: hideCard, nodeRef } = useEntryExitTransition()
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()
  const { canInstall, canNativeInstall, install, isInstalled } = usePWAInstall()
  const hasAutoShownRef = useRef(false)
  const engagementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // State only — the engagement timing lives in the auto-show effect.
  const isEligible = useCallback(() => {
    if (!profile) return false
    if (isInstalled || isPWAInstalled) return false
    if (!canInstall) return false
    if (platform === 'ios' && !iosSupportsWebPush) return false

    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed === 'permanent') return false

    const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return false

    const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
    if (count >= MAX_PROMPT_COUNT) return false

    return true
  }, [profile, isInstalled, isPWAInstalled, canInstall, platform, iosSupportsWebPush])

  const show = useCallback(() => {
    if (!isEligible()) return

    const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
    localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1))

    showCard()
  }, [isEligible, showCard])

  const hide = useCallback(
    (permanent = false) => {
      // Persist before the exit transition so a re-show can't race the write.
      if (permanent) {
        localStorage.setItem(DISMISSED_KEY, 'permanent')
      }
      hideCard()
    },
    [hideCard]
  )

  // Reset the iOS panel only after the card has fully exited.
  useEffect(() => {
    if (!mounted) setShowIOSSteps(false)
  }, [mounted])

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSSteps(true)
    } else if (canNativeInstall) {
      const accepted = await install()
      if (accepted) {
        hide(true)
      }
    }
  }

  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  const handleClose = () => hide(true)

  // Auto-show heuristic: logged in + 2nd-or-later session + 30s on page, so the prompt
  // reaches invested users rather than drive-by visitors.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasAutoShownRef.current) return
    if (!profile) return
    if (!isEligible()) return

    const sessionKey = `${SESSION_COUNT_KEY}-tracked`
    if (!sessionStorage.getItem(sessionKey)) {
      const sessions = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10) + 1
      localStorage.setItem(SESSION_COUNT_KEY, String(sessions))
      sessionStorage.setItem(sessionKey, '1')
    }

    const sessions = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10)
    if (sessions < MIN_SESSION_COUNT) return

    engagementTimerRef.current = setTimeout(() => {
      if (isEligible() && !hasAutoShownRef.current) {
        hasAutoShownRef.current = true
        show()
      }
    }, ENGAGEMENT_DELAY_MS)

    return () => {
      if (engagementTimerRef.current) {
        clearTimeout(engagementTimerRef.current)
      }
    }
  }, [profile, isEligible, show])

  // Programmatic trigger skips the engagement wait, not the eligibility checks.
  useEffect(() => {
    const handler = () => {
      hasAutoShownRef.current = false
      show()
    }
    window.addEventListener(SHOW_PWA_INSTALL_EVENT, handler)
    return () => window.removeEventListener(SHOW_PWA_INSTALL_EVENT, handler)
  }, [show])

  useEffect(() => {
    if (isInstalled && mounted) hide(true)
  }, [isInstalled, mounted, hide])

  if (!mounted) return null

  return (
    <div
      ref={nodeRef}
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
      className={twMerge(
        // Above docked chat / pad sash (z-50) — design-system above-floating tier
        'fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[60] mx-auto max-w-md',
        'transition-[opacity,transform] duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          'rounded-box flex flex-col gap-4 px-5 py-4',
          'surface-inverse',
          'shadow-xl',
          'border-base-300 border'
        )}>
        {showIOSSteps ? (
          <IOSInstructions onBack={() => setShowIOSSteps(false)} onClose={handleClose} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-field p-2">
                  <LuSmartphone size={24} className="text-primary" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="text-sm font-semibold">
                    Install docs.plus
                  </h3>
                  <p className="text-xs opacity-60">Get the full app experience</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="hover:bg-base-content/10 rounded-field -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-[opacity,background-color] hover:opacity-100"
                aria-label="Dismiss install prompt permanently">
                <LuX size={16} />
              </button>
            </div>

            <ul id="pwa-install-desc" className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Push notifications for replies & mentions</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Faster loading & works offline</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>Quick access from your home screen</span>
              </li>
            </ul>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={handleLater}
                className="hover:bg-base-content/10 rounded-field cursor-pointer px-4 py-2 text-sm font-medium opacity-70 transition-[opacity,background-color] hover:opacity-100">
                Maybe Later
              </button>
              <button
                onClick={handleInstall}
                className="bg-primary hover:bg-primary/90 text-primary-content rounded-field flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium transition-colors">
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

function IOSInstructions({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-field p-2">
            <LuSquarePlus size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Add to Home Screen</h3>
            <p className="text-xs opacity-60">Follow these steps in Safari</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-base-content/10 rounded-field -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-[opacity,background-color] hover:opacity-100"
          aria-label="Dismiss">
          <LuX size={16} />
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            1
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Tap</span>
            <LuShare size={18} className="text-primary" />
            <span className="opacity-70">in Safari&apos;s toolbar</span>
          </div>
        </li>
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            2
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Scroll down, tap</span>
            <LuSquarePlus size={18} className="text-primary" />
            <span className="font-medium">&quot;Add to Home Screen&quot;</span>
          </div>
        </li>
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            3
          </div>
          <span className="text-sm">
            Tap <span className="font-medium">&quot;Add&quot;</span> — then open from Home Screen
          </span>
        </li>
      </ol>

      <div className="flex justify-end pt-1">
        <button
          onClick={onBack}
          className="text-primary cursor-pointer text-sm font-medium hover:underline">
          ← Back
        </button>
      </div>
    </>
  )
}

export default PWAInstallPrompt
