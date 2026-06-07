/**
 * Platform detection utilities (framework-agnostic)
 *
 * Pure functions — no React, no side-effects, safe to call from hooks,
 * service-worker helpers, or any other context.
 *
 * iPadOS note:
 * iPadOS 13+ reports its user-agent as macOS Safari (no "iPad" in UA).
 * We use the maxTouchPoints heuristic to distinguish iPads from Macs.
 * This is the industry-standard method (Google Analytics, Apple docs, MDN).
 */

// ── iPad detection ──────────────────────────────────────────────────────────

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

// ── iOS detection ───────────────────────────────────────────────────────────

/**
 * Detect if the device is any iOS variant (iPhone, iPod, iPad/iPadOS).
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent

  if (/iPhone|iPod/.test(ua) && !(window as any).MSStream) return true
  if (isIPadDevice()) return true

  return false
}

// ── iOS version ─────────────────────────────────────────────────────────────

/**
 * Parse iOS version from the user-agent string.
 *
 * For iPadOS 13+ (which reports as macOS) we map the macOS version back:
 *   macOS 10.15 → iPadOS 13, macOS 11 → iPadOS 14, etc.
 *
 * Returns null on non-iOS devices.
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

// ── Platform category ───────────────────────────────────────────────────────

export type DevicePlatform = 'ios' | 'android' | 'web'

/**
 * Classify the device into ios / android / web.
 * "web" means desktop browser (Mac, Windows, Linux).
 */
export function getDevicePlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'web'

  if (isIOSDevice()) return 'ios'

  if (/Android/.test(navigator.userAgent)) return 'android'

  return 'web'
}
