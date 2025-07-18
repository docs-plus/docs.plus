import { twMerge } from 'tailwind-merge'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

export const Actions = ({ children, className = '', ...props }: Props) => {
  return (
    <div
      className={twMerge('actions flex items-center gap-1 px-1 pb-1 sm:px-2', className)}
      {...props}>
      {children}
    </div>
  )
}

Actions.displayName = 'Actions'
