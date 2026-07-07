import { Icons } from '@icons'
import type { MessageMediaKind } from '@types'
import { messagePreviewKind } from '@utils/messagePreview'
import type { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

const PREVIEW_KIND_ICONS: Partial<Record<MessageMediaKind, IconType>> = {
  image: Icons.image,
  video: Icons.video,
  audio: Icons.music,
  file: Icons.fileText
}

type Props = {
  preview: string | null | undefined
}

export function NotificationAttachmentHint({ preview }: Props) {
  const kind = messagePreviewKind(preview?.trim() ?? '')
  if (!kind) return null

  const Icon = kind === 'multi' ? Icons.fileText : (PREVIEW_KIND_ICONS[kind] ?? Icons.fileText)

  return (
    <div
      className={twMerge(
        'bg-base-300/40 rounded-field flex size-10 shrink-0 items-center justify-center',
        kind === 'multi' && 'text-base-content/70'
      )}
      aria-hidden>
      <Icon size={18} className="text-base-content/70" />
    </div>
  )
}
