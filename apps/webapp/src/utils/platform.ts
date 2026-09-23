/**
 * iPadOS 13+ spoofs as Mac. Macs have maxTouchPoints === 0; iPads have 5+.
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

// On Apple, Ctrl-F is the emacs forward-char key in text fields, so only Meta is Mod.
const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

/**
 * Mod+`key` (lowercase letter) with exactly the given Shift state and no Alt.
 * A Latin `event.key` wins, so Dvorak Mod-u stays underline; `code` only covers non-Latin layouts.
 */
export function isModShortcut(
  event: KeyboardEvent,
  key: string,
  { shift = false }: { shift?: boolean } = {}
): boolean {
  if (event.altKey || event.shiftKey !== shift) return false
  const mod = IS_APPLE ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!mod) return false
  const pressed = event.key ?? ''
  if (/^[a-z]$/i.test(pressed)) return pressed.toLowerCase() === key
  return event.code === `Key${key.toUpperCase()}`
}
