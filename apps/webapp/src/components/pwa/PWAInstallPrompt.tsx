import { useEntryExitTransition } from '@hooks/useEntryExitTransition'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { useAuthStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuDownload, LuSmartphone } from 'react-icons/lu'

import { IOSInstructions } from './IOSInstructions'
import { promptCardClassName, PromptHeader } from './PromptHeader'
import {
  DISMISSED_KEY,
  PROMPT_COUNT_KEY,
  PWA_OFFLINE_LINE,
  SESSION_COUNT_KEY,
  SHOW_PWA_INSTALL_EVENT,
  type ShowPWAInstallDetail,
  SNOOZED_UNTIL_KEY,
  usePWAInstall,
  usePWAInstallStore
} from './pwaInstallStore'

const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PROMPT_COUNT = 3
const ENGAGEMENT_DELAY_MS = 30_000
const MIN_SESSION_COUNT = 2
// Both branches render these ids, so the dialog's label and description always resolve.
const TITLE_ID = 'pwa-install-title'
const DESC_ID = 'pwa-install-desc'
const BENEFITS = [
  'Push notifications for replies & mentions',
  PWA_OFFLINE_LINE,
  'Quick access from your home screen'
]

interface PWAInstallPromptProps {
  className?: string
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const { mounted, shown, show: showCard, hide: hideCard, nodeRef } = useEntryExitTransition()
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { platform, iosSupportsWebPush } = usePlatformDetection()
  const { canInstall, canNativeInstall, install, isInstalled } = usePWAInstall()
  const autoShowHeld = usePWAInstallStore((s) => s.autoShowHolds > 0)
  const hasAutoShownRef = useRef(false)
  const engagementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only a timer-opened card yields to Home Install. A deliberate open stays.
  const openedByTimerRef = useRef(false)

  // State only — the engagement timing lives in the auto-show effect.
  const isEligible = useCallback(() => {
    if (!profile) return false
    if (isInstalled) return false
    if (!canInstall) return false
    if (platform === 'ios' && !iosSupportsWebPush) return false

    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed === 'permanent') return false

    const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return false

    const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
    if (count >= MAX_PROMPT_COUNT) return false

    return true
  }, [profile, isInstalled, canInstall, platform, iosSupportsWebPush])

  // A forced open checks only whether this window can install. It spends no timed-card budget.
  const show = useCallback(
    (force = false) => {
      if (force) {
        if (isInstalled || !canInstall) return
      } else {
        if (!isEligible()) return
        const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
        localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1))
      }

      showCard()
    },
    [isEligible, isInstalled, canInstall, showCard]
  )

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
    if (mounted) return
    setShowIOSSteps(false)
    openedByTimerRef.current = false
  }, [mounted])

  // Home Install came into view over a timed card. Close it with no snooze, dismiss, or count write.
  useEffect(() => {
    if (!autoShowHeld || !mounted || !openedByTimerRef.current) return
    openedByTimerRef.current = false
    hideCard()
  }, [autoShowHeld, mounted, hideCard])

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
    // Re-arms when the hold lifts, so leaving Home does not cost this session its timed card.
    if (autoShowHeld) return

    engagementTimerRef.current = setTimeout(() => {
      if (isEligible() && !hasAutoShownRef.current) {
        hasAutoShownRef.current = true
        openedByTimerRef.current = true
        show()
      }
    }, ENGAGEMENT_DELAY_MS)

    return () => {
      if (engagementTimerRef.current) {
        clearTimeout(engagementTimerRef.current)
      }
    }
  }, [profile, isEligible, show, autoShowHeld])

  // Programmatic trigger skips the engagement wait. Only a forced one skips eligibility.
  useEffect(() => {
    const handler = (e: Event) => {
      hasAutoShownRef.current = false
      openedByTimerRef.current = false
      show((e as CustomEvent<ShowPWAInstallDetail | null>).detail?.force === true)
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
      aria-labelledby={TITLE_ID}
      aria-describedby={DESC_ID}
      className={twMerge(
        // Above docked chat / pad sash (z-50) — design-system above-floating tier
        'fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[60] mx-auto max-w-md',
        'transition-[opacity,transform] duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}>
      <div className={promptCardClassName}>
        {showIOSSteps ? (
          <IOSInstructions
            titleId={TITLE_ID}
            descId={DESC_ID}
            onBack={() => setShowIOSSteps(false)}
            onClose={handleClose}
          />
        ) : (
          <>
            <PromptHeader
              icon={LuSmartphone}
              title="Install docs.plus"
              subtitle="Get the full app experience"
              titleId={TITLE_ID}
              closeLabel="Dismiss install prompt permanently"
              onClose={handleClose}
            />

            <ul id={DESC_ID} className="flex flex-col gap-2 text-sm">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-baseline gap-2">
                  <span className="opacity-60" aria-hidden="true">
                    •
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
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

export default PWAInstallPrompt
