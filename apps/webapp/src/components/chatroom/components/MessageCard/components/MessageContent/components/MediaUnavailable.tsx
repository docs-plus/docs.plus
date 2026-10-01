import Button from '@components/ui/Button'
import { Icons } from '@icons'
import type { MessageMediaKind } from '@types'
import { twMerge } from '@utils/twMerge'

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
        <Button
          variant="quiet"
          onClick={(event) => {
            event.stopPropagation()
            onRetry()
          }}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
