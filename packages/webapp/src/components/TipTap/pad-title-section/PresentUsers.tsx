import { useStore } from '@stores'
import React from 'react'

import AvatarStack from '../../AvatarStack'
const PresentUsers = () => {
  const usersPresence = useStore((state) => state.usersPresence)

  if (!usersPresence || usersPresence.size <= 1) return null

  return (
    <div className="hidden sm:block">
      <AvatarStack users={Array.from(usersPresence.values())} />
    </div>
  )
}

export default React.memo(PresentUsers)
