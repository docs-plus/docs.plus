import React from 'react'
import AvatarStack from '../../AvatarStack'
import { useStore } from '@stores'
const PresentUsers = () => {
  const usersPresence = useStore((state) => state.usersPresence)

  if (!usersPresence || usersPresence.size <= 1) return null

  return (
    <div className="sm:block hidden">
      <AvatarStack users={Array.from(usersPresence.values())} />
    </div>
  )
}

export default React.memo(PresentUsers)
