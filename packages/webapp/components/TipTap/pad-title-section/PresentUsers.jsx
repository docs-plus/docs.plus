import AvatarStack from '../../AvatarStack'
import { useEditorStateContext } from '@context/EditorContext'

const PresentUsers = ({ className }) => {
  const { presentUsers } = useEditorStateContext()

  if (!presentUsers) return null

  return (
    <div className={className}>
      <AvatarStack users={presentUsers} />
    </div>
  )
}

export default PresentUsers
