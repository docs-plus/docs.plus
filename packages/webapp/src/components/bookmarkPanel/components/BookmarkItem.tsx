import { archiveBookmark, markBookmarkAsRead, toggleMessageBookmark } from '@api'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore } from '@stores'
import PubSub from 'pubsub-js'
import { LuArchive, LuBookmarkCheck, LuBookmarkMinus,LuEye, LuLink } from 'react-icons/lu'

import { formatTimeAgo } from '../../notificationPanel/helpers'
import { usePopoverState } from '../../ui/Popover'

export const BookmarkItem = ({ bookmark }: { bookmark: any }) => {
  const { bookmarkActiveTab, removeBookmark, updateBookmarkStatus, moveBookmarkBetweenTabs } =
    useChatStore((state) => state)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const { close: closePopover } = usePopoverState()
  const handleViewBookmark = (bookmark: any) => {
    const messageId = bookmark.message_id
    const channelId = bookmark.message_channel_id

    if (headingId === channelId) destroyChatRoom()

    PubSub.publish(CHAT_OPEN, {
      headingId: channelId,
      toggleRoom: false,
      fetchMsgsFromId: messageId,
      scroll2Heading: true
    })

    closePopover()
  }

  const handleCopyUrl = (bookmark: any) => {
    const messageId = bookmark.message_id
    const channelId = bookmark.message_channel_id

    const newURL = new URL(location.href)
    newURL.searchParams.set('msg_id', messageId)
    newURL.searchParams.set('chatroom', channelId)

    navigator.clipboard
      .writeText(newURL.toString())
      .then(() => {
        toast.Success('URL copied to clipboard')
      })
      .catch((err) => {
        console.error('Failed to copy URL:', err)
        toast.Error('Failed to copy URL')
      })
  }

  const handleRemoveBookmark = async (bookmark: any) => {
    try {
      await toggleMessageBookmark({ messageId: bookmark.message_id })
      // Update store immediately
      removeBookmark(bookmark.bookmark_id)
      toast.Success('Bookmark removed')
    } catch (error) {
      console.error('Failed to remove bookmark:', error)
      toast.Error('Failed to remove bookmark')
    }
  }

  const handleArchiveBookmark = async (bookmark: any) => {
    try {
      const isArchived = !!bookmark.bookmark_archived_at
      await archiveBookmark({ bookmarkId: bookmark.bookmark_id, archive: !isArchived })

      // Update store immediately
      const now = new Date().toISOString()
      const updates = {
        bookmark_archived_at: !isArchived ? now : null,
        bookmark_updated_at: now
      }
      updateBookmarkStatus(bookmark.bookmark_id, updates)

      // Move between tabs if needed
      if (!isArchived) {
        // Moving to archive
        moveBookmarkBetweenTabs(bookmark.bookmark_id, bookmarkActiveTab, 'archive')
      } else {
        // Moving from archive to in progress
        moveBookmarkBetweenTabs(bookmark.bookmark_id, 'archive', 'in progress')
      }

      toast.Success(isArchived ? 'Bookmark unarchived' : 'Bookmark archived')
    } catch (error) {
      console.error('Failed to archive bookmark:', error)
      toast.Error('Failed to archive bookmark')
    }
  }

  const handleMarkAsRead = async (bookmark: any) => {
    try {
      const isRead = !!bookmark.bookmark_marked_at
      await markBookmarkAsRead({ bookmarkId: bookmark.bookmark_id, markAsRead: !isRead })

      // Update store immediately
      const now = new Date().toISOString()
      const updates = {
        bookmark_marked_at: !isRead ? now : null,
        bookmark_updated_at: now
      }
      updateBookmarkStatus(bookmark.bookmark_id, updates)

      // Move between tabs if needed (only if not archived)
      if (!bookmark.bookmark_archived_at) {
        if (!isRead) {
          // Moving to read tab
          moveBookmarkBetweenTabs(bookmark.bookmark_id, 'in progress', 'read')
        } else {
          // Moving back to in progress
          moveBookmarkBetweenTabs(bookmark.bookmark_id, 'read', 'in progress')
        }
      }

      toast.Success(isRead ? 'Marked as unread' : 'Marked as read')
    } catch (error) {
      console.error('Failed to mark bookmark:', error)
      toast.Error('Failed to mark bookmark')
    }
  }

  return (
    <div
      className="rounded-box border-base-300 bg-base-100 hover:bg-base-200 my-2 flex w-full items-start gap-3 border p-3 transition-colors"
      key={bookmark.bookmark_id}>
      <div className="size-10 flex-shrink-0">
        <Avatar
          id={bookmark.user_details.id}
          src={bookmark.user_details.avatar_url}
          avatarUpdatedAt={bookmark.user_details.avatar_updated_at}
          clickable={false}
          className="border-base-300 size-10 cursor-pointer rounded-full border"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex w-full flex-col items-start gap-2">
          <div className="flex w-full items-center gap-2">
            <p className="flex flex-col items-start gap-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-base-content font-medium">
                  {bookmark.user_details.fullname || bookmark.user_details.username}
                </span>
              </span>
            </p>
            <div className="join ml-auto">
              <Button
                onClick={() => handleViewBookmark(bookmark)}
                variant="ghost"
                size="sm"
                shape="square"
                className="join-item tooltip tooltip-left text-info hover:bg-info/10"
                data-tip="View in chat"
                startIcon={LuEye}
              />
            </div>
          </div>
          <p className="bg-base-200 text-base-content/70 w-full truncate rounded-lg p-2.5 text-sm">
            {bookmark.message_content}
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-base-content/50 text-xs">
            {formatTimeAgo(bookmark.bookmark_created_at)}
          </span>
        </div>

        <div className="mt-2 flex w-full items-center justify-between">
          <Button
            onClick={() => handleRemoveBookmark(bookmark)}
            data-tip="Delete Bookmark"
            variant="ghost"
            size="sm"
            shape="square"
            className="tooltip text-base-content/50 hover:bg-error/10 hover:text-error"
            startIcon={LuBookmarkMinus}
          />
          <div className="join">
            {bookmarkActiveTab !== 'archive' && (
              <Button
                onClick={() => handleArchiveBookmark(bookmark)}
                variant="ghost"
                size="sm"
                shape="square"
                className="join-item tooltip text-base-content/50 hover:bg-base-200"
                data-tip={bookmark.bookmark_archived_at ? 'Unarchive' : 'Archive'}
                startIcon={LuArchive}
              />
            )}
            {bookmarkActiveTab !== 'read' && (
              <Button
                onClick={() => handleMarkAsRead(bookmark)}
                variant="ghost"
                size="sm"
                shape="square"
                className="join-item tooltip text-base-content/50 hover:bg-base-200"
                data-tip={bookmark.bookmark_marked_at ? 'Mark as unread' : 'Mark as read'}
                startIcon={LuBookmarkCheck}
              />
            )}
            <Button
              onClick={() => handleCopyUrl(bookmark)}
              data-tip="Copy URL"
              variant="ghost"
              size="sm"
              shape="square"
              className="join-item tooltip tooltip-left text-base-content/50 hover:bg-base-200"
              endIcon={<LuLink size={16} className="-rotate-45" />}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
