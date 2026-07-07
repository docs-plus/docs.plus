import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  children: ReactNode
  className?: string
}

export function ChannelComposerSurface({ children, className }: Props) {
  const { variant } = useChatroomContext()
  const isDesktop = variant === 'desktop'

  return (
    <div
      className={twMerge(
        'channel-composer-surface border-base-300 bg-base-200 flex w-full items-center justify-center border px-3 py-3',
        isDesktop ? 'rounded-field mb-2' : 'rounded-t-box border-b-0',
        className
      )}>
      {children}
    </div>
  )
}
