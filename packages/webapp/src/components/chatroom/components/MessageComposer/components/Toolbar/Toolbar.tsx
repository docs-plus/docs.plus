import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'

type Props = {
  className?: string
  children: React.ReactNode
}
export const Toolbar = ({ className, children }: Props) => {
  const { showFormattingToolbar } = useMessageComposer()
  return (
    <div
      className={twMerge(
        'chatroom__toolbar flex w-full flex-row items-center justify-start gap-1',
        !showFormattingToolbar && 'hidden',
        className
      )}>
      {children}
    </div>
  )
}
