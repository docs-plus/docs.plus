import { useAuthStore } from '@stores'
import { twMerge } from 'tailwind-merge'

type Props = {
  children: React.ReactNode
  className?: string
}
export const GroupAuth = ({ children, className }: Props) => {
  const profile = useAuthStore((state) => state.profile)

  if (!profile) return null

  return <div className={twMerge('group-auth', className)}>{children}</div>
}
