import { getDevicePlatform, getIOSVersion, isIOSDevice } from '@utils/platform'
import { useCallback, useEffect, useState } from 'react'

const IOS_WEB_PUSH_MIN_VERSION = 16.4

export interface PlatformInfo {
  platform: 'ios' | 'android' | 'desktop'
  browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other'
  isPWAInstalled: boolean
  canInstallPWA: boolean
  supportsPush: boolean
  /** iOS can receive web push: 16.4 or later, and added to the Home Screen. */
  iosSupportsWebPush: boolean
}

function detectPlatform(): PlatformInfo {
  if (typeof window === 'undefined') {
    return {
      platform: 'desktop',
      browser: 'other',
      isPWAInstalled: false,
      canInstallPWA: false,
      supportsPush: false,
      iosSupportsWebPush: false
    }
  }

  const ua = navigator.userAgent

  // Shared lib, so iPad detection stays on the maxTouchPoints heuristic.
  const rawPlatform = getDevicePlatform()
  const platform: 'ios' | 'android' | 'desktop' = rawPlatform === 'web' ? 'desktop' : rawPlatform

  let browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' = 'other'
  if (ua.includes('Edg')) browser = 'edge'
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome'
  else if (ua.includes('Firefox')) browser = 'firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari'

  const isPWAInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true

  const canInstallPWA = 'serviceWorker' in navigator

  const supportsPush =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  // iOS hides the push APIs until the web app is installed, so the feature test only
  // answers there. Before install only the version can, and iPadOS freezes its user
  // agent at a Mac version that reads as iOS 13 — so trust only a real iOS token.
  const trustedIOSVersion = /OS \d+_\d+/.test(ua) ? getIOSVersion() : null
  const iosSupportsWebPush =
    isIOSDevice() &&
    (isPWAInstalled
      ? supportsPush
      : trustedIOSVersion === null || trustedIOSVersion >= IOS_WEB_PUSH_MIN_VERSION)

  return {
    platform,
    browser,
    isPWAInstalled,
    canInstallPWA,
    supportsPush,
    iosSupportsWebPush
  }
}

export function usePlatformDetection() {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => detectPlatform())

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const handleChange = () => {
      setPlatformInfo(detectPlatform())
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  /** On iOS the push APIs alone are not enough — push arrives only in an installed web app. */
  const canReceivePush = useCallback(() => {
    if (!platformInfo.supportsPush) return false

    if (platformInfo.platform === 'ios') {
      return platformInfo.isPWAInstalled
    }

    return true
  }, [platformInfo])

  return {
    ...platformInfo,
    canReceivePush
  }
}

export default usePlatformDetection
