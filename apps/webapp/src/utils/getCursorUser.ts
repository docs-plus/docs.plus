import type { Profile } from '@types'
import { resolveFace } from '@utils/avatarFace'

export interface CaretUser {
  name: string
  id: string
  color: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
}

// Relative luminance 0.24 keeps the 1px caret at 3:1 on every theme's paper, light or dark,
// and the fixed `--caret-label-ink` at 4.5:1 on the label plate. Measured over 2000 hues.
const CARET_LUMINANCE = 0.24
const CARET_SATURATION = 0.75

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: number[]) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

const hslToRgb = (h: number, s: number, l: number): number[] => {
  const a = s * Math.min(l, 1 - l)
  return [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  })
}

/** The hue is random; lightness is then solved so every hue lands on one luminance. */
const buildCaretColor = (): string => {
  const hue = Math.floor(Math.random() * 361)
  let low = 0
  let high = 1
  for (let step = 0; step < 20; step++) {
    const mid = (low + high) / 2
    if (luminance(hslToRgb(hue, CARET_SATURATION, mid)) < CARET_LUMINANCE) low = mid
    else high = mid
  }
  const rgb = hslToRgb(hue, CARET_SATURATION, low)
  return `#${rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

// One caret color per page load. Multiple awareness writers each rolling their own
// random color made the local caret flip colors on every reconnect/effect. Those
// writers also broadcast disagreeing user payloads back to back.
const caretColor = buildCaretColor()

export const getCursorUser = (profile: Profile | null): CaretUser => {
  const face = resolveFace(profile)
  const avatarUpdatedAt = face.avatarUpdatedAt != null ? String(face.avatarUpdatedAt) : null

  return {
    // Caret label keeps email fallback (resolveFace stops at username).
    name: face.displayName || profile?.email || 'Anonymous',
    id: face.id || profile?.email || 'anonymous',
    color: caretColor,
    avatarUrl: face.src ?? null,
    avatarUpdatedAt
  }
}
