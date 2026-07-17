import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMessageAuthorDetails } from '@components/chatroom/components/MessageCard/hooks/useMessageAuthorDetails'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { partitionMessageMedias } from '@components/chatroom/utils/galleryPlaylist'
import type { MessageSurfaceLayout } from '@components/chatroom/utils/messagePresentation'
import { pauseChatMediaElements } from '@components/chatroom/utils/pauseChatMediaElements'
import type { MessageMediaItem } from '@types'
import { formatGallerySentAt } from '@utils/formatGallerySentAt'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'
import { MessageMediaAudio } from './MessageMediaAudio'
import { MessageMediaFileCard } from './MessageMediaFileCard'
import { MessageMediaVisualBlock } from './MessageMediaVisualBlock'

type Props = {
  medias: MessageMediaItem[]
  layout?: MessageSurfaceLayout
  caption?: string | null
  className?: string
}

export function MessageMediaAttachments({ medias, layout, caption, className }: Props) {
  const openGallery = useChatMediaGalleryStore((state) => state.openGallery)
  const { variant } = useChatroomContext()
  const { message } = useMessageCardContext()
  const author = useMessageAuthorDetails(message)

  if (medias.length === 0) return null

  const { visuals, audio, files } = partitionMessageMedias(medias)

  const authorName = author?.fullname || author?.username || null

  const openAt = (target: MessageMediaItem) => {
    pauseChatMediaElements('feed')
    openGallery(medias, target, {
      caption,
      authorUserId: author?.id ?? message.user_id ?? null,
      authorName,
      authorAvatarUrl: author?.avatar_url ?? null,
      authorAvatarUpdatedAt: author?.avatar_updated_at ?? null,
      sentAtLabel: formatGallerySentAt(message.created_at),
      originMessage: message
    })
  }

  return (
    <div
      className={twMerge(
        'flex min-w-0 flex-col gap-1.5',
        layout === 'media-with-caption' && variant === 'mobile' && 'rounded-t-box overflow-hidden',
        className
      )}
      data-chat-media
      data-media-count={medias.length}>
      {visuals.length > 0 ? <MessageMediaVisualBlock visuals={visuals} onOpen={openAt} /> : null}
      {audio.map((media, index) => (
        <MessageMediaAudio
          key={`${media.path ?? media.url}-${index}`}
          media={media}
          onOpen={() => openAt(media)}
        />
      ))}
      {files.map((media, index) => (
        <MessageMediaFileCard key={`${media.path ?? media.url}-${index}`} media={media} />
      ))}
    </div>
  )
}
