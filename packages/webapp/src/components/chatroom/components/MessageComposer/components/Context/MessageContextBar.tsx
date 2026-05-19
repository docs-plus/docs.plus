import CloseButton from '@components/ui/CloseButton'
import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  onDismiss: () => void
  dismissLabel: string
  children: ReactNode
}

/** Reply / edit / comment strip inside the composer card. */
export const MessageContextBar = ({ icon, onDismiss, dismissLabel, children }: Props) => (
  <div className="border-base-300 bg-base-200/50 flex w-full items-start gap-2 border-b px-4 py-2">
    <span className="text-primary shrink-0 pt-0.5">{icon}</span>
    <div className="text-base-content flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    <CloseButton onClick={onDismiss} size="xs" aria-label={dismissLabel} className="shrink-0" />
  </div>
)
