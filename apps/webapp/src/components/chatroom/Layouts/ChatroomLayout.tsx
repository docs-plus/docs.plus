import { ChatroomPanelLayout, ChatroomSheetLayout } from '../components/Chatroom/layouts'

type Props = {
  children: React.ReactNode
  variant: 'desktop' | 'mobile'
}

export const ChatroomLayout = ({ children, variant }: Props) => {
  if (variant === 'desktop') return <ChatroomPanelLayout>{children}</ChatroomPanelLayout>

  return <ChatroomSheetLayout>{children}</ChatroomSheetLayout>
}
