import { useEditeMessageInfo, setEditeMessage } from '../../hooks/useReplyOrForwardMessage'
import { twx, cn } from '@utils/twx'
import { IoCloseOutline } from 'react-icons/io5'
import { RiPencilFill } from 'react-icons/ri'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((props) =>
  cn(
    'btn btn-circle w-8 h-8 btn-xs p-1 mr-2',
    props.$active && 'btn-active',
    props.$size && `w-${props.$size} h-${props.$size}`
  )
)

export const EditeMessageIndicator = () => {
  const editeMessage = useEditeMessageInfo()

  const handleCloseEditeMessage = () => {
    setEditeMessage(null)
  }

  const replyToUser =
    editeMessage?.user_details?.fullname || editeMessage?.user_details?.username || ''

  if (!editeMessage) return null

  return (
    <div className="flex w-full  items-center justify-between px-4 py-2 text-base-content">
      <RiPencilFill size={24} />
      <div className="flex w-full flex-col justify-start pl-3 text-base text-base-content">
        <span className="font-semibold text-primary antialiased">
          Edite message
          <span className=" ml-1 font-normal">{replyToUser}</span>
        </span>
        <span className="text-sm">{editeMessage?.content}</span>
      </div>
      <IconButton onClick={handleCloseEditeMessage}>
        <IoCloseOutline size={22} />
      </IconButton>
    </div>
  )
}
