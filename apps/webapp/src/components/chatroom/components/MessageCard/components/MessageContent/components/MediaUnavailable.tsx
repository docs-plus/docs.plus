import { Icons } from '@icons'
import type { MessageMediaKind } from '@types'
import { twMerge } from 'tailwind-merge'

const KIND_ICON = {
  image: Icons.image,
  video: Icons.video,
  audio: Icons.music,
  file: Icons.fileText
} as const

type Props = {
  label: string
  className?: string
  onRetry?: () => void
  kind?: MessageMediaKind
}

export function MediaUnavailable({ label, className, onRetry, kind = 'image' }: Props) {
  const Icon = KIND_ICON[kind]

  return (
    <div
      className={twMerge(
        'bg-base-200 text-base-content/70 flex flex-col items-center justify-center gap-1 p-3 text-xs',
        className
      )}>
      <Icon size={18} aria-hidden />
      <span className="text-center">{label}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRetry()
          }}
          className="text-primary hover:underline focus-visible:underline focus-visible:outline-none">
          Retry
        </button>
      ) : null}
    </div>
  )
}
