import type { Profile } from '@types'
import { resolveFace } from '@utils/avatarFace'
import randomColor from 'randomcolor'

export interface CaretUser {
  name: string
  id: string
  color: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
}

// One caret color per page load: multiple awareness writers each rolling
// their own randomColor made the local caret flip colors on every
// reconnect/effect and broadcast disagreeing user payloads back to back.
const caretColor = randomColor({ luminosity: 'light' })

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
