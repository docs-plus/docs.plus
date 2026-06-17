import CloseButton from '@components/ui/CloseButton'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export type ContextBarKind = 'reply' | 'comment' | 'edit'

const kindShell: Record<ContextBarKind, { bar: string; icon: string }> = {
  reply: { bar: 'border-l-[3px] border-l-info bg-base-200/40', icon: 'text-info' },
  comment: { bar: 'border-l-[3px] border-l-secondary bg-secondary/10', icon: 'text-secondary' },
  edit: { bar: 'border-l-[3px] border-l-warning', icon: 'text-warning' }
}

type Props = {
  kind: ContextBarKind
  icon: ReactNode
  onDismiss: () => void
  dismissLabel: string
  children: ReactNode
}

export function MessageContextBar({ kind, icon, onDismiss, dismissLabel, children }: Props) {
  const shell = kindShell[kind]

  return (
    <div
      className={twMerge(
        'border-base-300/80 flex w-full items-center gap-2 border-b py-2 pr-3 pl-2',
        shell.bar
      )}>
      <span className={twMerge('shrink-0', shell.icon)}>{icon}</span>
      <div className="text-base-content flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        {children}
      </div>
      <CloseButton onClick={onDismiss} size="xs" aria-label={dismissLabel} className="shrink-0" />
    </div>
  )
}
