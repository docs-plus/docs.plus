/**
 * Notification Permission Prompt Card
 *
 * A friendly, non-intrusive UI that explains the value of notifications
 * before triggering the browser's permission prompt.
 *
 * Design: Unified prompt card pattern (matches PWAInstallPrompt)
 * Position: Top-left for visibility without blocking main content
 */
import { showPWAInstallPrompt } from '@components/pwa'
import * as toast from '@components/toast'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { usePushNotifications } from '@hooks/usePushNotifications'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useState } from 'react'
import { LuBell, LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

// Storage keys
const STORAGE_KEY = 'notification-prompt-dismissed'
const PROMPT_COUNT_KEY = 'notification-prompt-count'
const SNOOZED_UNTIL_KEY = 'notification-prompt-snoozed-until'

// Snooze duration (24 hours in milliseconds)
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000

// Event for triggering the prompt
const SHOW_PROMPT_EVENT = 'show-notification-prompt'

/**
 * Call this after user performs a valuable action to show the prompt
 */
export function showNotificationPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PROMPT_EVENT))
  }
}

interface NotificationPromptCardProps {
  className?: string
}

export function NotificationPromptCard({ className }: NotificationPromptCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const profile = useAuthStore((state) => state.profile)
  const { subscribe } = usePushNotifications()
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  // Check if we should show the prompt (for iOS PWA detection)
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

  // Hide with animation
  const hide = useCallback((permanent = false) => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      if (permanent) {
        localStorage.setItem(STORAGE_KEY, 'permanent')
      }
    }, 300)
  }, [])

  // Handle "Enable" click
  const handleEnable = async () => {
    hide()

    await new Promise((r) => setTimeout(r, 300))

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
        // User closed browser prompt - don't nag
        break
      case 'error':
        // Server misconfiguration - don't spam user, just log
        console.error('Push notification setup failed')
        break
    }
  }

  // Handle "Later" click - snooze for 24 hours
  const handleLater = () => {
    localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS))
    hide(false)
  }

  // Handle "X" close (permanent dismiss)
  const handleClose = () => {
    hide(true)
  }

  // Listen for show event - handle immediately without waiting for hook
  useEffect(() => {
    const handler = async () => {
      if (!profile) return

      // Check iOS PWA requirements first
      if (!shouldShow()) return

      // Check notification permission directly
      const currentPermission = 'Notification' in window ? Notification.permission : 'unsupported'

      // If permission already granted, register the subscription
      if (currentPermission === 'granted') {
        const result = await subscribe()
        if (result === 'success') {
          toast.Success("Notifications enabled! You'll never miss a reply.")
        }
        return
      }

      // If permission is default, show the prompt card
      if (currentPermission === 'default') {
        // Check localStorage dismissals
        const dismissed = localStorage.getItem(STORAGE_KEY)
        if (dismissed === 'permanent') return

        const snoozedUntil = localStorage.getItem(SNOOZED_UNTIL_KEY)
        if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return

        const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10)
        if (count >= 3) return

        // Increment count and show
        localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1))
        setTimeout(() => {
          setIsVisible(true)
          requestAnimationFrame(() => setIsAnimating(true))
        }, 2000)
      }
    }
    window.addEventListener(SHOW_PROMPT_EVENT, handler)
    return () => window.removeEventListener(SHOW_PROMPT_EVENT, handler)
  }, [profile, subscribe, shouldShow])

  if (!isVisible) return null

  return (
    <div
      className={twMerge(
        // Position: top-left, below header
        'fixed top-6 left-6 z-50',
        // Size: wider for better readability
        'w-96 max-w-[calc(100vw-2rem)]',
        // Animation
        'transform transition-all duration-300 ease-out',
        isAnimating ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
        className
      )}>
      <div
        className={twMerge(
          // Unified prompt card — matches PWAInstallPrompt
          'rounded-box flex flex-col gap-4 px-5 py-4',
          // Theme-aware background
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          // Depth
          'shadow-xl',
          // Border
          'border-base-300 border'
        )}>
        {/* Header: icon badge + title/subtitle + close */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-selector p-2">
              <LuBell size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Never miss a reply!</h3>
              <p className="text-xs opacity-60">Stay in the loop</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-base-content/10 rounded-selector -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-all hover:opacity-100"
            aria-label="Dismiss permanently">
            <LuX size={16} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed opacity-70">
          Get instant notifications when someone mentions you or replies to your messages.
        </p>

        {/* Actions — secondary left, primary right (matches PWA prompt) */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={handleLater}
            className="hover:bg-base-content/10 rounded-selector cursor-pointer px-4 py-2 text-sm font-medium opacity-70 transition-all hover:opacity-100">
            Later
          </button>
          <button
            onClick={handleEnable}
            className="bg-primary hover:bg-primary/90 text-primary-content rounded-selector cursor-pointer px-4 py-2 text-sm font-medium transition-colors">
            Enable
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationPromptCard
