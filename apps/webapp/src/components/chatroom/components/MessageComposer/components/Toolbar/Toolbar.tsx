import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
  children: React.ReactNode
}

export const Toolbar = ({ className, children }: Props) => {
  return (
    <div className={twMerge('chatroom__toolbar flex min-w-0 flex-row items-center', className)}>
      {children}
    </div>
  )
}
