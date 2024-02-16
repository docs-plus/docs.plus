import AvatarStack from '../../AvatarStack'
import { useStore } from '@stores'
const PresentUsers = () => {
  const {
    editor: { presentUsers }
  } = useStore((state) => state.settings)

  if (!presentUsers || presentUsers.length <= 1) return null

  return (
    <div className="sm:block hidden">
      <AvatarStack users={presentUsers} />
    </div>
  )
}

export default PresentUsers
