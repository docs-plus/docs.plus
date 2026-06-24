import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import type { MessageSurfaceLayout } from '@components/chatroom/utils/messagePresentation'
import type { MessageMediaItem } from '@types'
import { twMerge } from 'tailwind-merge'

import { MessageMediaAudio } from './MessageMediaAudio'
import { MessageMediaFileCard } from './MessageMediaFileCard'
import { MessageMediaImageGrid } from './MessageMediaImageGrid'
import { MessageMediaVideo } from './MessageMediaVideo'

type Props = {
  medias: MessageMediaItem[]
  layout?: MessageSurfaceLayout
  className?: string
}

export const MessageMediaAttachments = ({ medias, layout, className }: Props) => {
  const openGallery = useChatMediaGalleryStore((state) => state.openGallery)
  const { variant } = useChatroomContext()

  if (medias.length === 0) return null

  const images = medias.filter((media) => media.type === 'image')
  const others = medias.filter(
    (media): media is MessageMediaItem & { type: 'video' | 'audio' | 'file' } =>
      media.type === 'video' || media.type === 'audio' || media.type === 'file'
  )

  return (
    <div
      className={twMerge(
        'flex flex-col gap-1.5',
        // Mobile groups media+caption into one rounded bubble; desktop keeps the
        // media tile fully rounded as its own block (cohesive with text rows).
        layout === 'media-with-caption' && variant === 'mobile' && 'overflow-hidden rounded-t-lg',
        className
      )}
      data-chat-media
      data-media-count={medias.length}>
      {images.length > 0 && (
        <MessageMediaImageGrid images={images} onExpand={(index) => openGallery(images, index)} />
      )}
      {others.map((media, index) => {
        switch (media.type) {
          case 'video':
            return <MessageMediaVideo key={`${media.path ?? media.url}-${index}`} media={media} />
          case 'audio':
            return <MessageMediaAudio key={`${media.path ?? media.url}-${index}`} media={media} />
          case 'file':
            return (
              <MessageMediaFileCard key={`${media.path ?? media.url}-${index}`} media={media} />
            )
          default: {
            const _exhaustive: never = media.type
            return null
          }
        }
      })}
    </div>
  )
}
