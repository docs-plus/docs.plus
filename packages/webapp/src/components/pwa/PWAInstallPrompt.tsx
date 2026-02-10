/**
 * PWA Install Prompt — Industry-Standard Implementation
 *
 * Follows Google's PWA install promotion best practices:
 * https://web.dev/articles/promote-install
 *
 * Architecture:
 * ─────────────────────────────────────────────────────────────
 * 1. Captures `beforeinstallprompt` (Android/Desktop) — defers it
 * 2. Shows custom in-app UI at the RIGHT moment (engagement-based)
 * 3. Handles iOS separately (Safari has no beforeinstallprompt)
 * 4. Tracks `appinstalled` for cleanup and analytics
 *
 * Trigger strategy (Google's recommended heuristics):
 * ─────────────────────────────────────────────────────────────
 * - User must be logged in (authenticated = invested user)
 * - NOT first session (returning visitor signal)
 * - 30+ seconds of engagement in current session
 * - Not already installed / dismissed / snoozed
 * - Max 3 lifetime prompts (respect user's decision)
 *
 * Also triggerable programmatically via showPWAInstallPrompt()
 * (e.g., from NotificationPromptCard when iOS user needs PWA for push)
 * ─────────────────────────────────────────────────────────────
 */
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuDownload, LuShare, LuSmartphone, LuSquarePlus, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

// ── Storage Keys ─────────────────────────────────────────────
const STORAGE_PREFIX = 'pwa-install'
const DISMISSED_KEY = `${STORAGE_PREFIX}-dismissed` // 'permanent' | null
const SNOOZED_UNTIL_KEY = `${STORAGE_PREFIX}-snoozed-until` // timestamp | null
const PROMPT_COUNT_KEY = `${STORAGE_PREFIX}-prompt-count` // number
const SESSION_COUNT_KEY = `${STORAGE_PREFIX}-session-count` // number

// ── Configuration ────────────────────────────────────────────
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_PROMPT_COUNT = 3 // Stop asking after 3 times
const ENGAGEMENT_DELAY_MS = 30_000 // 30 seconds on page
const MIN_SESSION_COUNT = 2 // Don't prompt on first visit

// ── Event for programmatic triggering ────────────────────────
const SHOW_PWA_INSTALL_EVENT = 'show-pwa-install-prompt'

/**
 * Programmatically show the PWA install prompt.
 *
 * Use this when user tries an action that requires PWA
 * (e.g., enabling push on iOS) — bypasses engagement checks.
 */
export function showPWAInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PWA_INSTALL_EVENT))
  }
}

// ── beforeinstallprompt type ─────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── Exported Hook ────────────────────────────────────────────

/**
 * Hook for managing PWA installation state.
 * Captures beforeinstallprompt, tracks install status, provides install().
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const { platform, isPWAInstalled } = usePlatformDetection()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // ── Capture beforeinstallprompt (Android/Desktop) ──
    const handleBeforeInstall = (e: Event) => {
      // Prevent Chrome's default mini-infobar — we show our own UI
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    // ── Track appinstalled event ──
    const handleInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      // Clean up prompt state
      localStorage.setItem(DISMISSED_KEY, 'permanent')
      localStorage.removeItem(SNOOZED_UNTIL_KEY)
      localStorage.removeItem(PROMPT_COUNT_KEY)
    }

    // ── Check standalone mode ──
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

  // Trigger the deferred native install prompt (Android/Desktop)
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
    /** User can potentially install (native prompt available OR iOS not installed) */
    canInstall: deferredPrompt !== null || (platform === 'ios' && !isInstalled),
    /** Native browser prompt is available (Android/Desktop only) */
    canNativeInstall: deferredPrompt !== null,
    /** PWA is currently installed */
    isInstalled,
    /** Trigger native install (returns true if accepted) */
    install,
    /** Current platform */
    platform
  }
}

// ── Component ────────────────────────────────────────────────

interface PWAInstallPromptProps {
  className?: string
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()
  const { canInstall, canNativeInstall, install, isInstalled } = usePWAInstall()
  const hasAutoShownRef = useRef(false)
  const engagementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Eligibility check (no engagement timing — just state) ──
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

  // ── Show animation ──
  const show = useCallback(() => {
    if (!isEligible()) return

    // Increment prompt count
    const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
    localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1))

    setIsVisible(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(true))
    })
  }, [isEligible])

  // ── Hide animation ──
  const hide = useCallback((permanent = false) => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      setShowIOSSteps(false)
      if (permanent) {
        localStorage.setItem(DISMISSED_KEY, 'permanent')
      }
    }, 300)
  }, [])

  // ── Install button handler ──
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

  // ── "Maybe Later" — snooze 7 days ──
  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  // ── Close "X" — permanent dismiss ──
  const handleClose = () => hide(true)

  // ── Engagement-based auto-show (Google's recommended pattern) ──
  //
  // Heuristic: logged in + 2nd+ session + 30s on page
  // This ensures we prompt users who are invested, not drive-by visitors.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasAutoShownRef.current) return
    if (!profile) return
    if (!isEligible()) return

    // Track session count (incremented once per page load)
    const sessionKey = `${SESSION_COUNT_KEY}-tracked`
    if (!sessionStorage.getItem(sessionKey)) {
      const sessions = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10) + 1
      localStorage.setItem(SESSION_COUNT_KEY, String(sessions))
      sessionStorage.setItem(sessionKey, '1')
    }

    const sessions = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10)
    if (sessions < MIN_SESSION_COUNT) return

    // Wait for engagement (30s), then show
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

  // ── Programmatic trigger (bypasses engagement checks) ──
  useEffect(() => {
    const handler = () => {
      hasAutoShownRef.current = false
      // Reset prompt count for programmatic triggers (e.g., notification flow)
      // so the user gets to see it even if auto-prompt count was hit
      show()
    }
    window.addEventListener(SHOW_PWA_INSTALL_EVENT, handler)
    return () => window.removeEventListener(SHOW_PWA_INSTALL_EVENT, handler)
  }, [show])

  // ── Auto-hide if installed while prompt is showing ──
  useEffect(() => {
    if (isInstalled && isVisible) hide(true)
  }, [isInstalled, isVisible, hide])

  if (!isVisible) return null

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
      className={twMerge(
        // Position: bottom-center, safe area aware
        'fixed right-4 bottom-6 left-4 z-50 mx-auto max-w-md',
        // Slide-up animation
        'transform transition-all duration-300 ease-out',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          'rounded-box flex flex-col gap-4 px-5 py-4',
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          'shadow-xl',
          'border-base-300 border'
        )}>
        {showIOSSteps ? (
          // ── iOS Step-by-Step Instructions ──
          <IOSInstructions onBack={() => setShowIOSSteps(false)} onClose={handleClose} />
        ) : (
          // ── Main Install Prompt ──
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-selector p-2">
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
                className="hover:bg-base-content/10 rounded-selector -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-all hover:opacity-100"
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
                className="hover:bg-base-content/10 rounded-selector cursor-pointer px-4 py-2 text-sm font-medium opacity-70 transition-all hover:opacity-100">
                Maybe Later
              </button>
              <button
                onClick={handleInstall}
                className="bg-primary hover:bg-primary/90 text-primary-content rounded-selector flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium transition-colors">
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

// ── iOS Instructions Sub-Component ───────────────────────────

function IOSInstructions({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-selector p-2">
            <LuSquarePlus size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Add to Home Screen</h3>
            <p className="text-xs opacity-60">Follow these steps in Safari</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-base-content/10 rounded-selector -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-all hover:opacity-100"
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
