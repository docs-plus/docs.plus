import { twMerge } from 'tailwind-merge'

interface Props {
  children: React.ReactNode
  className?: string
}

export const Actions = ({ children, className = '' }: Props) => {
  return (
    <div
      role="group"
      aria-label="Message actions"
      className={twMerge(
        'composer-bar__actions flex shrink-0 items-end gap-1 pb-0.5 sm:items-center sm:gap-1.5 sm:pb-0',
        className
      )}>
      {children}
    </div>
  )
}

Actions.displayName = 'Actions'
