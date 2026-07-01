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
        'composer-bar__actions flex shrink-0 items-center gap-1 sm:gap-1.5',
        className
      )}>
      {children}
    </div>
  )
}

Actions.displayName = 'Actions'
