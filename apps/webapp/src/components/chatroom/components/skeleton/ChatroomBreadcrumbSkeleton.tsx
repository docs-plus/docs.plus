import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  variant?: keyof ChatroomVariant
}

export const ChatroomBreadcrumbSkeleton = ({ className, variant = 'desktop' }: Props) => {
  if (variant === 'mobile') {
    return (
      <div className={twMerge('min-w-0 flex-1', className)} aria-hidden>
        <div className="skeleton rounded-field h-2.5 w-14" />
        <div className="skeleton rounded-field mt-1 h-3 w-28 max-w-[min(100%,11rem)]" />
      </div>
    )
  }

  return (
    <nav className={twMerge('flex min-w-0 flex-1 items-center gap-1', className)} aria-hidden>
      <div className="skeleton rounded-field h-3 w-10" />
      <div className="skeleton rounded-field size-2.5 shrink-0" />
      <div className="skeleton rounded-field h-3 w-20 max-w-[min(100%,8rem)]" />
    </nav>
  )
}
