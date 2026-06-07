import { twMerge } from 'tailwind-merge'

import { useHandleEscKey } from '../../hooks/useHandleEscKey'

type Props = {
  children?: React.ReactNode
  className?: string
}

export const Context = ({ className = '', children }: Props) => {
  useHandleEscKey()

  return <div className={twMerge('message-context', className)}>{children}</div>
}

Context.displayName = 'Context'
