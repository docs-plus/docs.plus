import { twMerge } from 'tailwind-merge'

interface Props {
  children: React.ReactNode
  className?: string
}

export const Actions = ({ children, className = '' }: Props) => {
  return (
    <div className={twMerge('actions flex items-center gap-1 px-1 pb-1 sm:px-2', className)}>
      {children}
    </div>
  )
}

Actions.displayName = 'Actions'
