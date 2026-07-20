import { selectPresenceOthers } from '@services/workspacePresenceSync'
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
  const others = useMemo(
    () => selectPresenceOthers(usersPresence?.values(), profile?.id),
    [usersPresence, profile?.id]
  )

  if (others.length === 0) return null

  return (
    <div className="hidden sm:block">
      <AvatarStack users={others} size="sm" surface="outline" />
    </div>
  )
}

export default React.memo(PresentUsers)
