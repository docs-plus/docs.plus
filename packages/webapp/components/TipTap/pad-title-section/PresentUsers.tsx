import AvatarStack from '../../AvatarStack'
import { useStore } from '@stores'
const PresentUsers = ({ className }: any) => {
  const {
    editor: { presentUsers }
  } = useStore((state) => state.settings)

  if (!presentUsers) return null

  return (
    <div className={className}>
      <AvatarStack users={presentUsers} />
    </div>
  )
}

export default PresentUsers