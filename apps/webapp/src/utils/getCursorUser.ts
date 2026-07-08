import type { Profile } from '@types'
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

export const getCursorUser = (profile: Profile | null): CaretUser => ({
  name: profile?.display_name || profile?.username || profile?.email || 'Anonymous',
  id: profile?.id || profile?.email || 'anonymous',
  color: caretColor,
  avatarUrl: profile?.avatar_url || null,
  avatarUpdatedAt: profile?.avatar_updated_at || null
})
