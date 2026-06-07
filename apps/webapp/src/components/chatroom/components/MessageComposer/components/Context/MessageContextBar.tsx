import CloseButton from '@components/ui/CloseButton'
import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  onDismiss: () => void
  dismissLabel: string
  children: ReactNode
}

export const MessageContextBar = ({ icon, onDismiss, dismissLabel, children }: Props) => (
  <div className="border-base-300/80 flex w-full items-center gap-2 border-b px-3 py-2">
    <span className="text-primary shrink-0">{icon}</span>
    <div className="text-base-content flex min-w-0 flex-1 flex-col gap-0.5 text-sm">{children}</div>
    <CloseButton onClick={onDismiss} size="xs" aria-label={dismissLabel} className="shrink-0" />
  </div>
)
