import { useMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

function pickContextBarMedia(medias: MessageMediaItem[]): MessageMediaItem | null {
  if (medias.length === 0) return null
  return medias.find((media) => media.type === 'image') ?? medias[0]!
}

type Props = {
  medias: MessageMediaItem[]
}

export function ContextBarMediaThumb({ medias }: Props) {
  const media = useMemo(() => pickContextBarMedia(medias), [medias])
  const imageUrl = useMediaDisplayUrl(media?.type === 'image' ? media : null)

  if (!media) return null

  const theme = messageMediaTheme(media.type)

  if (media.type === 'image') {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="border-base-content/10 rounded-field size-10 shrink-0 border object-cover"
        />
      )
    }
    return (
      <div
        className={twMerge(
          'rounded-field flex size-10 shrink-0 items-center justify-center border',
          theme.iconBg,
          theme.cardBorder
        )}
        aria-hidden>
        <Icons.image size={16} className={theme.accent} />
      </div>
    )
  }

  const Icon =
    media.type === 'video' ? Icons.video : media.type === 'audio' ? Icons.music : Icons.fileText

  return (
    <div
      className={twMerge(
        'rounded-field flex size-10 shrink-0 items-center justify-center border',
        theme.iconBg,
        theme.cardBorder
      )}
      aria-hidden>
      <Icon size={16} className={theme.accent} />
    </div>
  )
}
