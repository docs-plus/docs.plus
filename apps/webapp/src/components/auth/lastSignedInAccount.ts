import type { Profile } from '@types'

const STORAGE_KEY = 'docsplus:last-signed-in-account'
/** Shipped briefly, held a bare first name. Removed on read so it does not linger. */
const LEGACY_STORAGE_KEY = 'docsplus:last-signed-in-name'
const MAX_NAME_LENGTH = 24

export type LastSignedInAccount = {
  /** First name only, for the button label. */
  name: string
  /** Passed to Google as `login_hint` so the button lands on the right account. */
  email: string
  /** Bucket / OAuth face. Optional so older localStorage rows still read. */
  id?: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | number | null
}

/** Last-account label for "Continue as". A hint only — the click still runs Google. */
export function rememberSignedInAccount(profile: Profile, email: string | null | undefined): void {
  if (typeof window === 'undefined' || !email) return

  const source =
    profile.display_name || profile.full_name || profile.fullname || profile.username || ''
  // First token only, so "Hossein Marzban" greets as "Hossein".
  const name = (source.trim().split(/\s+/)[0] ?? '').slice(0, MAX_NAME_LENGTH)
  if (!name) return

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name,
        email,
        id: profile.id,
        avatarUrl: profile.avatar_url ?? null,
        avatarUpdatedAt: profile.avatar_updated_at ?? null
      })
    )
  } catch {
    // Private mode or a full quota. A missing label is not worth failing sign-in.
  }
}

export function readSignedInAccount(): LastSignedInAccount | null {
  if (typeof window === 'undefined') return null
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LastSignedInAccount>
    if (!parsed?.name || !parsed?.email) return null
    return {
      name: parsed.name,
      email: parsed.email,
      id: parsed.id,
      avatarUrl: parsed.avatarUrl ?? null,
      avatarUpdatedAt: parsed.avatarUpdatedAt ?? null
    }
  } catch {
    // Hand-edited or half-written value. Treat it as absent.
    return null
  }
}

/** "Not you?" only. Sign-out must not clear this, or the label almost never shows. */
export function forgetSignedInAccount(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to recover; the label is best-effort.
  }
}
