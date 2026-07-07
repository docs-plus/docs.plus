import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

type Props = {
  variant?: keyof ChatroomVariant
  className?: string
}

export const ChatroomComposerSkeleton = ({ variant = 'desktop', className }: Props) => {
  const isDesktop = variant === 'desktop'

  return (
    <div
      className={twMerge('channel-composer w-full', isDesktop && 'm-auto w-[98%]', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading composer">
      <div
        className={twMerge(
          'flex flex-col overflow-hidden',
          isDesktop
            ? 'border-base-300 bg-base-200 rounded-field mb-2 border'
            : 'composer-bar--mobile bg-base-100 border-base-300 border-t'
        )}>
        <div
          className={twMerge(
            'flex w-full items-center',
            isDesktop ? 'gap-1.5 px-2.5 py-1.5' : 'min-h-11 gap-1 px-3 py-2'
          )}>
          <div
            className={twMerge('skeleton rounded-field shrink-0', isDesktop ? 'size-7' : 'size-10')}
          />
          <div
            className={twMerge(
              'skeleton rounded-field flex-1',
              isDesktop ? 'h-7' : 'h-10 min-h-10'
            )}
          />
          <div
            className={twMerge('skeleton shrink-0 rounded-full', isDesktop ? 'size-7' : 'size-10')}
          />
          <div
            className={twMerge('skeleton shrink-0 rounded-full', isDesktop ? 'size-7' : 'size-10')}
          />
        </div>
      </div>
    </div>
  )
}
