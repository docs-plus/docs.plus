import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
  variant?: keyof ChatroomVariant
}

/** Each bone sits in a box of its real line height. The chevron is known up front, so it stays real. */
export const ChatroomBreadcrumbSkeleton = ({ className, variant = 'desktop' }: Props) => {
  if (variant === 'mobile') {
    return (
      <div className={twMerge('min-w-0 flex-1', className)} aria-hidden>
        <div className="flex h-[1.25em] items-center text-xs">
          <div className="skeleton h-3 w-14" />
        </div>
        <div className="flex h-[1.25em] items-center text-sm">
          <div className="skeleton h-3.5 w-28 max-w-[min(100%,11rem)]" />
        </div>
      </div>
    )
  }

  return (
    <nav className={twMerge('flex min-w-0 flex-1 items-center gap-1', className)} aria-hidden>
      <div className="flex h-5 items-center">
        <div className="skeleton h-3.5 w-10" />
      </div>
      <Icons.chevronRight size={14} className="text-base-content/40 shrink-0" />
      <div className="flex h-5 min-w-0 items-center">
        <div className="skeleton h-3.5 w-20 max-w-[min(100%,8rem)]" />
      </div>
    </nav>
  )
}
