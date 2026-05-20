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
      className={twMerge('flex shrink-0 items-center gap-0.5', className)}>
      {children}
    </div>
  )
}

Actions.displayName = 'Actions'
