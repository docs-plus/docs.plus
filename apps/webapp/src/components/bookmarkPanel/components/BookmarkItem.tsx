import { useMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { PanelFeedItem } from '@components/PanelFeedItem'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useDismissPanel } from '@hooks/useDismissPanel'
import { Icons } from '@icons'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore } from '@stores'
import { type MessageMediaItem, type PanelSurfaceVariant, type TBookmarkWithMessage } from '@types'
import { formatTimeAgo } from '@utils/formatTime'
import { buildBookmarkHref } from '@utils/link-helpers'
import {
  GENERIC_ATTACHMENT_LABEL,
  messagePreviewKind,
  messagePreviewText
} from '@utils/messagePreview'
import PubSub from 'pubsub-js'
import { LuLink } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

import { useBookmarkPanelActions } from '../hooks/useBookmarkPanelActions'

type BookmarkItemProps = {
  bookmark: TBookmarkWithMessage
  variant?: PanelSurfaceVariant
}

function previewKindIcon(kind: NonNullable<ReturnType<typeof messagePreviewKind>>) {
  switch (kind) {
    case 'image':
      return Icons.image
    case 'video':
      return Icons.video
    case 'audio':
      return Icons.music
    case 'multi':
    default:
      return Icons.fileText
  }
}

function BookmarkMediaHint({ preview }: { preview: string }) {
  const kind = messagePreviewKind(preview)
  if (!kind) return null

  const Icon = previewKindIcon(kind)

  return (
    <div
      className={twMerge(
        'bg-base-300/40 flex size-10 shrink-0 items-center justify-center rounded-md',
        kind === 'multi' && 'text-base-content/70'
      )}
      aria-hidden>
      <Icon size={18} className="text-base-content/70" />
    </div>
  )
}

function BookmarkImageThumb({ media }: { media: MessageMediaItem }) {
  const url = useMediaDisplayUrl(media)
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      className="border-base-300 size-10 shrink-0 rounded-md border object-cover"
    />
  )
}

export const BookmarkItem = ({ bookmark, variant = 'popover' }: BookmarkItemProps) => {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const dismissPanel = useDismissPanel(variant)
  const { remove, markAsRead, archive, isExiting } = useBookmarkPanelActions()

  const exiting = isExiting(bookmark.bookmark_id)

  const handleViewBookmark = (bookmark: TBookmarkWithMessage) => {
    const messageId = bookmark.message_id
    const channelId = bookmark.message_channel_id

    if (headingId === channelId) destroyChatRoom()

    PubSub.publish(CHAT_OPEN, {
      headingId: channelId,
      toggleRoom: false,
      fetchMsgsFromId: messageId,
      scroll2Heading: true
    })

    dismissPanel()
  }

  const handleCopyUrl = (bookmark: TBookmarkWithMessage) => {
    const href = buildBookmarkHref({
      messageId: bookmark.message_id,
      channelId: bookmark.message_channel_id
    })

    navigator.clipboard
      .writeText(href)
      .then(() => {
        toast.Success('URL copied to clipboard')
      })
      .catch((err) => {
        console.error('Failed to copy URL:', err)
        toast.Error('Failed to copy URL')
      })
  }

  const medias = parseMessageMedias(bookmark.message_medias)
  const previewText = messagePreviewText(bookmark.message_content, medias, bookmark.message_type)
  const thumbMedia = medias.find((media) => media.type === 'image') ?? null
  const isArchived = !!bookmark.bookmark_archived_at
  const isRead = !!bookmark.bookmark_marked_at

  return (
    <PanelFeedItem exiting={exiting}>
      <div className="size-9 shrink-0">
        <Avatar
          id={bookmark.user_details.id}
          src={bookmark.user_details.avatar_url}
          avatarUpdatedAt={bookmark.user_details.avatar_updated_at}
          clickable={false}
          className="border-base-300 size-9 rounded-full border"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="text-base-content text-sm font-medium">
              {bookmark.user_details.fullname || bookmark.user_details.username}
            </p>
            <div className="flex w-full min-w-0 items-start gap-2">
              {thumbMedia ? (
                <BookmarkImageThumb media={thumbMedia} />
              ) : (
                <BookmarkMediaHint preview={previewText} />
              )}
              <p className="bg-base-200 text-base-content/70 line-clamp-2 min-w-0 flex-1 rounded-lg px-2 py-1 text-sm">
                {previewText || GENERIC_ATTACHMENT_LABEL}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="text-base-content/50 hover:text-base-content shrink-0"
            onClick={() => handleCopyUrl(bookmark)}
            disabled={exiting}
            aria-label="Copy link">
            <LuLink size={14} className="rotate-45" />
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-base-content/50 text-xs">
            {formatTimeAgo(bookmark.bookmark_created_at)}
          </span>
          {bookmarkActiveTab === 'in progress' && !isRead && (
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void markAsRead(bookmark)
              }}
              variant="ghost"
              size="xs"
              className="text-primary hover:bg-primary/10"
              disabled={exiting}
              aria-busy={exiting}>
              Mark as read
            </Button>
          )}
          {bookmarkActiveTab !== 'archive' && (
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void archive(bookmark)
              }}
              variant="ghost"
              size="xs"
              className="text-base-content/60 hover:bg-base-200"
              disabled={exiting}
              aria-busy={exiting}>
              {isArchived ? 'Unarchive' : 'Archive'}
            </Button>
          )}
          <Button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void remove(bookmark)
            }}
            variant="ghost"
            size="xs"
            className="text-base-content/60 hover:bg-error/10 hover:text-error"
            disabled={exiting}
            aria-busy={exiting}>
            Remove
          </Button>
          <Button
            onClick={() => handleViewBookmark(bookmark)}
            variant="primary"
            btnStyle="soft"
            size="xs"
            className="ml-auto"
            disabled={exiting}>
            View
          </Button>
        </div>
      </div>
    </PanelFeedItem>
  )
}
