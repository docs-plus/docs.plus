/**
 * Platform Detection Hook
 *
 * Detects device platform, PWA installation status, and push support.
 * Used for PWA install prompts and platform-specific push notification flows.
 */
import { useCallback, useEffect, useState } from 'react'

export interface PlatformInfo {
  /** Device platform */
  platform: 'ios' | 'android' | 'desktop'
  /** Browser name */
  browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other'
  /** PWA is installed (running in standalone mode) */
  isPWAInstalled: boolean
  /** Browser supports PWA installation */
  canInstallPWA: boolean
  /** Browser supports push notifications */
  supportsPush: boolean
  /** iOS version (null if not iOS) */
  iosVersion: number | null
  /** iOS supports web push (16.4+) */
  iosSupportsWebPush: boolean
}

/**
 * Detect iOS version from user agent
 */
function getIOSVersion(): number | null {
  if (typeof window === 'undefined') return null

  const ua = navigator.userAgent
  const match = ua.match(/OS (\d+)_(\d+)/)
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`)
  }
  return null
}

/**
 * Detect platform info from user agent and browser APIs
 */
function detectPlatform(): PlatformInfo {
  if (typeof window === 'undefined') {
    return {
      platform: 'desktop',
      browser: 'other',
      isPWAInstalled: false,
      canInstallPWA: false,
      supportsPush: false,
      iosVersion: null,
      iosSupportsWebPush: false
    }
  }

  const ua = navigator.userAgent

  // Platform detection
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isAndroid = /Android/.test(ua)
  const platform: 'ios' | 'android' | 'desktop' = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'

  // Browser detection
  let browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' = 'other'
  if (ua.includes('Edg')) browser = 'edge'
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome'
  else if (ua.includes('Firefox')) browser = 'firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari'

  // PWA installation status (standalone mode)
  const isPWAInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true

  // PWA installation support
  const canInstallPWA = 'serviceWorker' in navigator

  // Push notification support
  const supportsPush =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  // iOS version and web push support (iOS 16.4+)
  const iosVersion = isIOS ? getIOSVersion() : null
  const iosSupportsWebPush = iosVersion !== null && iosVersion >= 16.4

  return {
    platform,
    browser,
    isPWAInstalled,
    canInstallPWA,
    supportsPush,
    iosVersion,
    iosSupportsWebPush
  }
}

/**
 * Hook for platform detection
 *
 * @example
 * const { platform, isPWAInstalled, supportsPush, iosSupportsWebPush } = usePlatformDetection()
 *
 * if (platform === 'ios' && !isPWAInstalled) {
 *   // Show iOS "Add to Home Screen" prompt
 * }
 */
export function usePlatformDetection() {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => detectPlatform())

  // Listen for display-mode changes (user installs PWA)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const handleChange = () => {
      setPlatformInfo(detectPlatform())
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  /**
   * Check if user should see iOS install prompt
   * - On iOS
   * - Not installed as PWA
   * - iOS 16.4+ (supports web push)
   */
  const shouldShowIOSInstallPrompt = useCallback(() => {
    return (
      platformInfo.platform === 'ios' &&
      !platformInfo.isPWAInstalled &&
      platformInfo.iosSupportsWebPush
    )
  }, [platformInfo])

  /**
   * Check if push notifications will work
   * - Desktop: Always (if browser supports)
   * - Android PWA: Always (if browser supports)
   * - iOS PWA: Only if installed AND iOS 16.4+
   * - iOS Safari: Never (must install PWA first)
   */
  const canReceivePush = useCallback(() => {
    if (!platformInfo.supportsPush) return false

    // iOS: Only works if PWA is installed AND iOS 16.4+
    if (platformInfo.platform === 'ios') {
      return platformInfo.isPWAInstalled && platformInfo.iosSupportsWebPush
    }

    // Desktop and Android: Always works
    return true
  }, [platformInfo])

  return {
    ...platformInfo,
    shouldShowIOSInstallPrompt,
    canReceivePush
  }
}

export default usePlatformDetection
