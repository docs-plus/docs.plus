import { Icons } from '@icons'
import { commentReferenceJumpShell, type CommentReferenceTheme } from '@utils/commentReferenceTheme'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'

const REPLY_SHELL = 'border-l-info bg-base-200/80 hover:bg-base-300/55'

const BUTTON_CLASS =
  'text-base-content focus-visible:ring-primary relative z-[1] mb-1 block w-full cursor-pointer rounded-field border-l-4 p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'

type ReferenceJumpButtonBase = {
  dataKey: string
  ariaLabel: string
  onJump: () => void
  /** A jump to an unloaded message is fetching; the kind icon becomes the spinner. */
  busy?: boolean
  header: ReactNode
  children: ReactNode
}

export type ReferenceJumpButtonProps =
  | (ReferenceJumpButtonBase & { kind: 'reply' })
  | (ReferenceJumpButtonBase & { kind: 'comment'; commentTheme: CommentReferenceTheme })

export function ReferenceJumpButton(props: ReferenceJumpButtonProps) {
  const { dataKey, ariaLabel, onJump, busy = false, header, children, kind } = props

  let Icon = Icons.reply
  let label = 'Reply'
  let shell = REPLY_SHELL
  let iconClass = 'text-info'

  if (kind === 'comment') {
    Icon = Icons.comment
    label = 'Document comment'
    shell = commentReferenceJumpShell(props.commentTheme)
    iconClass = props.commentTheme.emphasis
  }

  return (
    <button
      type="button"
      data-key={dataKey}
      data-reference-kind={kind}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      className={twMerge(BUTTON_CLASS, shell)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onJump()
      }}>
      <div className={twMerge('mb-1.5 flex items-center gap-1.5 text-xs font-semibold', iconClass)}>
        {busy ? (
          <span className="loading loading-spinner size-3.5 shrink-0" aria-hidden />
        ) : (
          <Icon size={14} aria-hidden />
        )}
        <span>{label}</span>
        {header}
      </div>
      {children}
    </button>
  )
}
