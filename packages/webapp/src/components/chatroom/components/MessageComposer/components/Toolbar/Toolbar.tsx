import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'

type Props = {
  className?: string
  children: React.ReactNode
}
export const Toolbar = ({ className, children }: Props) => {
  const { isToolbarOpen } = useMessageComposer()
  return (
    <div
      className={twMerge(
        'chatroom__toolbar flex w-full flex-row items-center justify-start gap-1',
        isToolbarOpen && 'hidden',
        className
      )}>
      {children}
    </div>
  )
}
