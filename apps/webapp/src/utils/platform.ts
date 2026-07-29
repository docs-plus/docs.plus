// Pure functions, no React and no side effects — safe from hooks, service-worker
// helpers, or anywhere else.

/**
 * Detect if the device is an iPad, including iPadOS 13+ which spoofs as Mac.
 * Macs have maxTouchPoints === 0; iPads have 5+.
 */
export function isIPadDevice(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent

  // Classic iPad (pre-iPadOS 13)
  if (/iPad/.test(ua)) return true

  // iPadOS 13+: reports as Macintosh but has touch support
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true

  return false
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent

  if (/iPhone|iPod/.test(ua) && !(window as any).MSStream) return true
  if (isIPadDevice()) return true

  return false
}

/**
 * null on non-iOS devices. iPadOS 13+ reports a macOS version, so it is mapped
 * back: macOS 10.15 → iPadOS 13, macOS 11 → iPadOS 14, and so on.
 */
export function getIOSVersion(): number | null {
  if (typeof window === 'undefined') return null

  const ua = navigator.userAgent

  // iPhone / iPod — version is in the UA
  const match = ua.match(/OS (\d+)_(\d+)/)
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`)
  }

  // iPadOS 13+ — derive from macOS version
  if (isIPadDevice()) {
    const macMatch = ua.match(/Mac OS X (\d+)[._](\d+)/)
    if (macMatch) {
      const major = parseInt(macMatch[1], 10)
      const minor = parseInt(macMatch[2], 10)
      if (major === 10 && minor >= 15) return 13 + (minor - 15)
      if (major >= 11) return major + 2
    }
    // Can't parse, but only iPadOS 13+ spoofs desktop UA — assume modern
    return 16.4
  }

  return null
}

export type DevicePlatform = 'ios' | 'android' | 'web'

/** "web" means a desktop browser — Mac, Windows, or Linux. */
export function getDevicePlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'web'

  if (isIOSDevice()) return 'ios'

  if (/Android/.test(navigator.userAgent)) return 'android'

  return 'web'
}
