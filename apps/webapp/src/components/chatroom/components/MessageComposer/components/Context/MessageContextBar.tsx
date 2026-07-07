import CloseButton from '@components/ui/CloseButton'
import {
  commentReferenceContextBarShell,
  type CommentReferenceTheme
} from '@utils/commentReferenceTheme'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export type ContextBarKind = 'reply' | 'comment' | 'edit'

const STATIC_SHELL: Record<Exclude<ContextBarKind, 'comment'>, { bar: string; icon: string }> = {
  reply: { bar: 'border-l-[3px] border-l-info bg-base-200/40', icon: 'text-info' },
  edit: { bar: 'border-l-[3px] border-l-warning', icon: 'text-warning' }
}

type MessageContextBarBase = {
  icon: ReactNode
  onDismiss: () => void
  dismissLabel: string
  children: ReactNode
}

export type MessageContextBarProps =
  | (MessageContextBarBase & { kind: 'reply' | 'edit' })
  | (MessageContextBarBase & { kind: 'comment'; commentTheme: CommentReferenceTheme })

function resolveShell(props: MessageContextBarProps): { bar: string; icon: string } {
  switch (props.kind) {
    case 'comment':
      return {
        bar: commentReferenceContextBarShell(props.commentTheme),
        icon: props.commentTheme.emphasis
      }
    case 'reply':
    case 'edit':
      return STATIC_SHELL[props.kind]
    default: {
      const _exhaustive: never = props
      return _exhaustive
    }
  }
}

export function MessageContextBar(props: MessageContextBarProps) {
  const { icon, onDismiss, dismissLabel, children } = props
  const shell = resolveShell(props)

  return (
    <div
      className={twMerge(
        'border-base-300 flex w-full items-center gap-2 border-b py-2 pr-3 pl-2',
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
