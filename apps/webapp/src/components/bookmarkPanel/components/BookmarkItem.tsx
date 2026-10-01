import { useMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import {
  openChatAtMessage,
  PanelFeedActions,
  PanelFeedCopyLink,
  PanelFeedItem,
  PanelFeedMediaHint,
  PanelFeedPreview,
  PanelFeedRowAction
} from '@components/PanelFeedItem'
import { Avatar } from '@components/ui/Avatar'
import { useDismissPanelBeforeNavigate } from '@hooks/useDismissPanel'
import { useChatStore } from '@stores'
import { type MessageMediaItem, type PanelSurfaceVariant, type TBookmarkWithMessage } from '@types'
import { GENERIC_ATTACHMENT_LABEL, messagePreviewText } from '@utils/messagePreview'

import { useBookmarkPanelActions } from '../hooks/useBookmarkPanelActions'

type BookmarkItemProps = {
  bookmark: TBookmarkWithMessage
  variant?: PanelSurfaceVariant
}

function BookmarkImageThumb({ media }: { media: MessageMediaItem }) {
  const url = useMediaDisplayUrl(media)
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      className="border-base-300 rounded-field size-10 shrink-0 border object-cover"
    />
  )
}

export const BookmarkItem = ({ bookmark, variant = 'popover' }: BookmarkItemProps) => {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const dismissBeforeNavigate = useDismissPanelBeforeNavigate(variant)
  const { remove, markAsRead, archive, isExiting } = useBookmarkPanelActions()

  const exiting = isExiting(bookmark.bookmark_id)

  const handleViewBookmark = async (bookmark: TBookmarkWithMessage) => {
    await dismissBeforeNavigate()
    openChatAtMessage(bookmark.message_channel_id, bookmark.message_id)
  }

  const medias = parseMessageMedias(bookmark.message_medias)
  const previewText = messagePreviewText(bookmark.message_content, medias, bookmark.message_type)
  const thumbMedia = medias.find((media) => media.type === 'image') ?? null
  const isArchived = !!bookmark.bookmark_archived_at
  const isRead = !!bookmark.bookmark_marked_at
  return (
    <PanelFeedItem exiting={exiting}>
      <div className="size-8 shrink-0">
        <Avatar face={bookmark.user_details} clickable={false} size="sm" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="text-base-content text-sm font-medium">
              {bookmark.user_details.fullname || bookmark.user_details.username}
            </p>
            <PanelFeedPreview
              media={
                thumbMedia ? (
                  <BookmarkImageThumb media={thumbMedia} />
                ) : (
                  <PanelFeedMediaHint preview={previewText} />
                )
              }>
              {previewText || GENERIC_ATTACHMENT_LABEL}
            </PanelFeedPreview>
          </div>
          <PanelFeedCopyLink
            messageId={bookmark.message_id}
            channelId={bookmark.message_channel_id}
            disabled={exiting}
          />
        </div>

        <PanelFeedActions
          createdAt={bookmark.bookmark_created_at}
          onView={() => void handleViewBookmark(bookmark)}
          disabled={exiting}>
          {bookmarkActiveTab === 'in progress' && !isRead && (
            <PanelFeedRowAction onClick={() => void markAsRead(bookmark)} disabled={exiting}>
              Mark as read
            </PanelFeedRowAction>
          )}
          {bookmarkActiveTab !== 'archive' && (
            <PanelFeedRowAction onClick={() => void archive(bookmark)} disabled={exiting}>
              {isArchived ? 'Unarchive' : 'Archive'}
            </PanelFeedRowAction>
          )}
          <PanelFeedRowAction onClick={() => void remove(bookmark)} disabled={exiting} danger>
            Remove
          </PanelFeedRowAction>
        </PanelFeedActions>
      </div>
    </PanelFeedItem>
  )
}
