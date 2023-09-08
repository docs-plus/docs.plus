import AvatarStack from '../../AvatarStack'
import { useEditorStateContext } from '@context/EditorContext'

const PresentUsers = ({ className }) => {
  const { presentUsers } = useEditorStateContext()

  return <div className={className}>{presentUsers && <AvatarStack users={presentUsers} />}</div>
}

export default PresentUsers
