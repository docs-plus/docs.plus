import { AvatarStack } from '@components/ui/AvatarStack'
import { selectPresenceOthers } from '@services/workspacePresenceSync'
import { useAuthStore, useStore } from '@stores'
import React, { useMemo } from 'react'

const PresentUsers = () => {
  const usersPresence = useStore((state) => state.usersPresence)
  const profile = useAuthStore((state) => state.profile)

  // Authed users `track(profile)` themselves into presence, so drop self or
  // "alone in the room" renders a self-avatar (a no-op for anon, who never track).
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
