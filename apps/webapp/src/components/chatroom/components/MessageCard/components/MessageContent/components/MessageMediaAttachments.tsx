import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMessageAuthorDetails } from '@components/chatroom/components/MessageCard/hooks/useMessageAuthorDetails'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { partitionMessageMedias } from '@components/chatroom/utils/galleryPlaylist'
import type { MessageSurfaceLayout } from '@components/chatroom/utils/messagePresentation'
import type { MessageMediaItem } from '@types'
import { formatGallerySentAt } from '@utils/formatGallerySentAt'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'
import { MessageMediaAudio } from './MessageMediaAudio'
import { MessageMediaFileCard } from './MessageMediaFileCard'
import { MessageMediaImageGrid } from './MessageMediaImageGrid'
import { MessageMediaVideo } from './MessageMediaVideo'

type Props = {
  medias: MessageMediaItem[]
  layout?: MessageSurfaceLayout
  caption?: string | null
  className?: string
}

const pauseFeedMedia = () => {
  document.querySelectorAll('[data-chat-media] video, [data-chat-media] audio').forEach((el) => {
    if (el instanceof HTMLMediaElement) el.pause()
  })
}

export const MessageMediaAttachments = ({ medias, layout, caption, className }: Props) => {
  const openGallery = useChatMediaGalleryStore((state) => state.openGallery)
  const { variant } = useChatroomContext()
  const { message } = useMessageCardContext()
  const author = useMessageAuthorDetails(message)

  if (medias.length === 0) return null

  const { images, galleryOthers, files } = partitionMessageMedias(medias)

  const authorName = author?.fullname || author?.username || null

  const openAt = (target: number | MessageMediaItem) => {
    pauseFeedMedia()
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
        'flex flex-col gap-1.5',
        layout === 'media-with-caption' && variant === 'mobile' && 'overflow-hidden rounded-t-lg',
        className
      )}
      data-chat-media
      data-media-count={medias.length}>
      {images.length > 0 && (
        <MessageMediaImageGrid images={images} onExpand={(index) => openAt(images[index]!)} />
      )}
      {galleryOthers.map((media, index) => {
        if (media.type === 'video') {
          return (
            <MessageMediaVideo
              key={`${media.path ?? media.url}-${index}`}
              media={media}
              onOpen={() => openAt(media)}
            />
          )
        }
        if (media.type === 'audio') {
          return (
            <MessageMediaAudio
              key={`${media.path ?? media.url}-${index}`}
              media={media}
              onOpen={() => openAt(media)}
            />
          )
        }
        return null
      })}
      {files.map((media, index) => (
        <MessageMediaFileCard key={`${media.path ?? media.url}-${index}`} media={media} />
      ))}
    </div>
  )
}
