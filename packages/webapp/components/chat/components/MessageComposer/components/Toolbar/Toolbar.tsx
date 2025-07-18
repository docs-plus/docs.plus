import { useChannel } from '@components/chat/context/ChannelProvider'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  children: React.ReactNode
}
export const Toolbar = ({ className, children }: Props) => {
  const { toggleToolbar } = useMessageComposer()
  return (
    <div
      className={twMerge(
        'chatroom__toolbar flex w-full flex-row items-center justify-start gap-1',
        toggleToolbar && 'hidden',
        className
      )}>
      {children}
    </div>
  )
}
