import { useAuthStore, useStore } from '@stores'
import React, { useMemo } from 'react'

import AvatarStack from '../../AvatarStack'

const PresentUsers = () => {
  const usersPresence = useStore((state) => state.usersPresence)
  const profile = useAuthStore((state) => state.profile)

  // Authed users `track(profile)` themselves into presence, so the map
  // includes self — filter it out so "alone in the room" doesn't render
  // a single self-avatar. Anon never tracks, so the map is already just
  // the other viewers; the filter is a harmless no-op for them.
  const others = useMemo(() => {
    if (!usersPresence) return []
    const selfId = (profile as { id?: string } | null)?.id
    return Array.from(usersPresence.values()).filter((u) => (u as { id?: string }).id !== selfId)
  }, [usersPresence, profile])

  if (others.length === 0) return null

  return (
    <div className="hidden sm:block">
      <AvatarStack users={others} />
    </div>
  )
}

export default React.memo(PresentUsers)
