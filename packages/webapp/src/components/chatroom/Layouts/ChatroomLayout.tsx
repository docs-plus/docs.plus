import { DesktopLayout, MobileLayout } from '../components/Chatroom/layouts'

type Props = {
  children: React.ReactNode
  variant: 'desktop' | 'mobile'
}

export const ChatroomLayout = ({ children, variant }: Props) => {
  if (variant === 'desktop') return <DesktopLayout>{children}</DesktopLayout>

  return <MobileLayout>{children}</MobileLayout>
}
