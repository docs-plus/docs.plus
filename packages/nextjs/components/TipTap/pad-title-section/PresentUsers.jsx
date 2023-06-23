import React, { useEffect, useState } from 'react'
import AvatarStack from '../../AvatarStack'
import { useEditorStateContext } from '@context/EditorContext'

const PresentUsers = ({ className, user }) => {
  const { EditorProvider } = useEditorStateContext()
  const [presentUsers, setPresentUsers] = useState(null)
  useEffect(() => {
    if (!EditorProvider) return

    const awarenessUpdateHandler = ({ states }) => {
      if (states.length > 0) return
      if (!user) return setPresentUsers(states)
      // if user is present, remove it from the list
      setPresentUsers(() => {
        return states.filter((x) => x.user?.id !== user.id)
      })
    }

    EditorProvider.on('awarenessUpdate', awarenessUpdateHandler)

    return () => {
      if (EditorProvider) {
        EditorProvider.off('awarenessUpdate', awarenessUpdateHandler)
      }
    }
  }, [EditorProvider])
  return <div className={className}>{presentUsers && <AvatarStack users={presentUsers} />}</div>
}

export default PresentUsers
