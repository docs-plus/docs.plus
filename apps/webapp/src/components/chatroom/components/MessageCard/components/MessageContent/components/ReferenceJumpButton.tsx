import { Icons } from '@icons'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export type ReferenceKind = 'reply' | 'comment'

const kindShell: Record<ReferenceKind, string> = {
  reply: 'border-l-info bg-base-200/80 hover:bg-base-300/55',
  comment: 'border-l-secondary bg-secondary/10 hover:bg-secondary/15'
}

const kindMeta: Record<
  ReferenceKind,
  { Icon: typeof Icons.reply; iconClass: string; label: string }
> = {
  reply: { Icon: Icons.reply, iconClass: 'text-info', label: 'Reply' },
  comment: { Icon: Icons.comment, iconClass: 'text-secondary', label: 'Document comment' }
}

type Props = {
  kind: ReferenceKind
  dataKey: string
  ariaLabel: string
  widthClass: string
  onJump: () => void
  header: ReactNode
  children: ReactNode
}

export function ReferenceJumpButton({
  kind,
  dataKey,
  ariaLabel,
  widthClass,
  onJump,
  header,
  children
}: Props) {
  const { Icon, iconClass, label } = kindMeta[kind]

  return (
    <button
      type="button"
      data-key={dataKey}
      data-reference-kind={kind}
      aria-label={ariaLabel}
      className={twMerge(
        'text-base-content focus-visible:ring-primary relative z-[1] mb-1 block cursor-pointer rounded border-l-4 p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
        kindShell[kind],
        widthClass
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onJump()
      }}>
      <div className={twMerge('mb-1.5 flex items-center gap-1.5 text-xs font-semibold', iconClass)}>
        <Icon size={14} aria-hidden />
        <span>{label}</span>
        {header}
      </div>
      {children}
    </button>
  )
}
