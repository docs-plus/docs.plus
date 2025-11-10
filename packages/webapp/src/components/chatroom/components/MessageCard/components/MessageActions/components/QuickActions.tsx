import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  children?: React.ReactNode
}
// For hover action
export const QuickActions = ({ className, children }: Props) => {
  return (
    <div className={twMerge('join bg-base-300 rounded-md shadow-xs', className)}>{children}</div>
  )
}
