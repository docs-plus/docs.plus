/**
 * Explains the value of notifications before triggering the browser's permission prompt.
 * Shares the prompt-card pattern with PWAInstallPrompt.
 */
import { showPWAInstallPrompt } from '@components/pwa'
import * as toast from '@components/toast'
import { useEntryExitTransition } from '@hooks/useEntryExitTransition'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { usePushNotifications } from '@hooks/usePushNotifications'
import { useAuthStore } from '@stores'
import { MOTION_PANEL_MS } from '@utils/motion'
import { useCallback, useEffect } from 'react'
import { LuBell, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

const STORAGE_KEY = 'notification-prompt-dismissed'
const PROMPT_COUNT_KEY = 'notification-prompt-count'
const SNOOZED_UNTIL_KEY = 'notification-prompt-snoozed-until'

const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000

const SHOW_PROMPT_EVENT = 'show-notification-prompt'

/** Call after the user performs a valuable action, so the ask lands on an invested user. */
export function showNotificationPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PROMPT_EVENT))
  }
}

interface NotificationPromptCardProps {
  className?: string
}

export function NotificationPromptCard({ className }: NotificationPromptCardProps) {
  const { mounted, shown, show, hide: hideCard, nodeRef } = useEntryExitTransition()
  const profile = useAuthStore((state) => state.profile)
  const { subscribe } = usePushNotifications()
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  const shouldShow = useCallback(() => {
    // iOS: Push only works if PWA is installed AND iOS 16.4+
    if (platform === 'ios') {
      if (!iosSupportsWebPush) return false
      if (!isPWAInstalled) {
        showPWAInstallPrompt()
        return false
      }
    }
    return true
  }, [platform, isPWAInstalled, iosSupportsWebPush])

  const hide = useCallback(
    (permanent = false) => {
      // Persist before the exit transition so a re-show can't race the write.
      if (permanent) {
        localStorage.setItem(STORAGE_KEY, 'permanent')
      }
      hideCard()
    },
    [hideCard]
  )

  const handleEnable = async () => {
    hide()

    // Let the card finish exiting before the browser permission prompt appears.
    await new Promise((r) => setTimeout(r, MOTION_PANEL_MS))

    const result = await subscribe()

    switch (result) {
      case 'success':
        toast.Success("Notifications enabled! You'll never miss a reply.")
        localStorage.setItem(STORAGE_KEY, 'permanent')
        break
      case 'denied':
        toast.Warning('Notifications blocked. You can enable them in browser settings.')
        localStorage.setItem(STORAGE_KEY, 'permanent')
        break
      case 'dismissed':
        break
      case 'error':
        console.error('Push notification setup failed')
        break
    }
  }

  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  const handleClose = () => {
    hide(true)
  }

  useEffect(() => {
    const handler = async () => {
      if (!profile) return

      if (!shouldShow()) return

      const currentPermission = 'Notification' in window ? Notification.permission : 'unsupported'

      // Already granted — subscription is managed by usePushNotifications() on mount.
      // No need to re-subscribe on every action.
      if (currentPermission === 'granted') return

      if (currentPermission === 'default') {
        const dismissed = localStorage.getItem(STORAGE_KEY)
        if (dismissed === 'permanent') return

        const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
        if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return

        const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
        if (count >= 3) return

        localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1))
        setTimeout(show, 2000)
      }
    }
    window.addEventListener(SHOW_PROMPT_EVENT, handler)
    return () => window.removeEventListener(SHOW_PROMPT_EVENT, handler)
  }, [profile, subscribe, shouldShow, show])

  if (!mounted) return null

  return (
    <div
      ref={nodeRef}
      className={twMerge(
        // Above pad sash/toolbars (z-50) — design-system above-floating tier
        'fixed top-6 left-6 z-[60]',
        'w-96 max-w-[calc(100vw-2rem)]',
        'transition-[opacity,transform] duration-200 ease-out',
        shown ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          'rounded-box flex flex-col gap-4 px-5 py-4',
          'surface-inverse',
          'shadow-xl',
          'border-base-300 border'
        )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-field p-2">
              <LuBell size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Never miss a reply!</h3>
              <p className="text-xs opacity-60">Stay in the loop</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-base-content/10 rounded-field -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-[opacity,background-color] hover:opacity-100"
            aria-label="Dismiss permanently">
            <LuX size={16} />
          </button>
        </div>

        <p className="text-sm leading-relaxed opacity-70">
          Get instant notifications when someone mentions you or replies to your messages.
        </p>

        {/* Actions — secondary left, primary right (matches PWA prompt) */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={handleLater}
            className="hover:bg-base-content/10 rounded-field cursor-pointer px-4 py-2 text-sm font-medium opacity-70 transition-[opacity,background-color] hover:opacity-100">
            Later
          </button>
          <button
            onClick={handleEnable}
            className="bg-primary hover:bg-primary/90 text-primary-content rounded-field cursor-pointer px-4 py-2 text-sm font-medium transition-colors">
            Enable
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationPromptCard
