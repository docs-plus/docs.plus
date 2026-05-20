import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  children: React.ReactNode
}

export const Toolbar = ({ className, children }: Props) => {
  return (
    <div
      className={twMerge(
        'chatroom__toolbar flex w-full flex-row items-center justify-start gap-1',
        className
      )}>
      {children}
    </div>
  )
}
