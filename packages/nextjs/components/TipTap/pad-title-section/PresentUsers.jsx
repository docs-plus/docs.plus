import React, { useEffect, useState } from 'react'
import AvatarStack from '../../AvatarStack'
import { useEditorStateContext } from '@context/EditorContext'

const PresentUsers = ({ className }) => {
  const { EditorProvider } = useEditorStateContext()
  const [presentUsers, setPresentUsers] = useState(null)
  useEffect(() => {
    if (!EditorProvider) return

    const awarenessUpdateHandler = ({ states }) => {
      if (states.length > 0) setPresentUsers(states)
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
