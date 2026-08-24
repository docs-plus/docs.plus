import { getDevicePlatform, getIOSVersion, isIOSDevice } from '@utils/platform'
import { useCallback, useEffect, useState } from 'react'

export interface PlatformInfo {
  platform: 'ios' | 'android' | 'desktop'
  browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other'
  isPWAInstalled: boolean
  canInstallPWA: boolean
  supportsPush: boolean
  iosVersion: number | null
  /** iOS 16.4+ — the first release with web push. */
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
      iosVersion: null,
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

  const isIOS = isIOSDevice()
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

  const shouldShowIOSInstallPrompt = useCallback(() => {
    return (
      platformInfo.platform === 'ios' &&
      !platformInfo.isPWAInstalled &&
      platformInfo.iosSupportsWebPush
    )
  }, [platformInfo])

  /** iOS Safari can never receive push — the PWA must be installed first. */
  const canReceivePush = useCallback(() => {
    if (!platformInfo.supportsPush) return false

    if (platformInfo.platform === 'ios') {
      return platformInfo.isPWAInstalled && platformInfo.iosSupportsWebPush
    }

    return true
  }, [platformInfo])

  return {
    ...platformInfo,
    shouldShowIOSInstallPrompt,
    canReceivePush
  }
}

export default usePlatformDetection
