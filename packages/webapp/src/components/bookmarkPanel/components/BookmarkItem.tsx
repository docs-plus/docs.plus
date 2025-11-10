import { Avatar } from '@components/ui/Avatar'
import { formatTimeAgo } from '../../notificationPanel/helpers'
import { useChatStore } from '@stores'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import {
  MdLink,
  MdOutlineBookmarkAdded,
  MdOutlineVisibility,
  MdOutlineInventory2,
  MdOutlineBookmarkRemove
} from 'react-icons/md'
import * as toast from '@components/toast'
import { archiveBookmark, markBookmarkAsRead, toggleMessageBookmark } from '@api'
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
      className="my-2 flex w-full items-start gap-4 rounded-lg border border-gray-300 p-3 hover:bg-gray-50"
      key={bookmark.bookmark_id}>
      <div className="h-10 w-10 flex-shrink-0">
        <Avatar
          id={bookmark.user_details.id}
          src={bookmark.user_details.avatar_url}
          avatarUpdatedAt={bookmark.user_details.avatar_updated_at}
          clickable={false}
          className="size-[42px] cursor-pointer rounded-full border border-gray-300 shadow-md"
        />
      </div>

      <div className="flex-1">
        <div className="flex w-full flex-col items-start gap-2">
          <div className="flex w-full items-center gap-2">
            <p className="flex flex-col items-start gap-1 text-sm font-bold">
              <span className="flex items-center gap-2">
                <span className="font-semibold">
                  {bookmark.user_details.fullname || bookmark.user_details.username}
                </span>
              </span>
              {/* <span className="text-xs text-gray-500">in #{bookmark.channel_name}</span> */}
            </p>
            <div className="join bg-base-300 ml-4 ml-auto rounded-md">
              <button
                onClick={() => handleViewBookmark(bookmark)}
                className="btn btn-ghost tooltip-left btn-square join-item btn-sm tooltip border-noungap-1 flex items-center bg-blue-100 text-blue-700 hover:bg-blue-200"
                data-tip="View in chat">
                <MdOutlineVisibility size={18} />
              </button>
            </div>
          </div>
          <p className="w-full rounded-md bg-gray-100 p-2 text-sm">{bookmark.message_content}</p>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {formatTimeAgo(bookmark.bookmark_created_at)}
          </span>
        </div>

        <div className="mt-2 ml-auto flex w-full justify-end">
          <button
            onClick={() => handleRemoveBookmark(bookmark)}
            data-tip="Delete Bookmark"
            className="btn btn-ghost btn-square join-item btn-sm tooltip border-noun mr-auto flex items-center gap-1 bg-red-100 text-red-500 hover:bg-red-200">
            <MdOutlineBookmarkRemove size={18} />
          </button>
          <div className="join bg-base-300 rounded-md">
            {bookmarkActiveTab !== 'archive' && (
              <button
                onClick={() => handleArchiveBookmark(bookmark)}
                className="btn btn-ghost btn-square join-item btn-sm tooltip border-noun flex items-center gap-1"
                data-tip={bookmark.bookmark_archived_at ? 'Unarchive' : 'Archive'}>
                <MdOutlineInventory2 size={18} />
              </button>
            )}
            {bookmarkActiveTab !== 'read' && (
              <button
                onClick={() => handleMarkAsRead(bookmark)}
                className="btn btn-ghost btn-square join-item btn-sm tooltip border-noun flex items-center gap-1"
                data-tip={bookmark.bookmark_marked_at ? 'Mark as unread' : 'Mark as read'}>
                <MdOutlineBookmarkAdded size={18} />
              </button>
            )}
            <button
              onClick={() => handleCopyUrl(bookmark)}
              data-tip="Copy URL"
              className="btn btn-ghost tooltip-left btn-square join-item btn-sm tooltip border-noun flex items-center gap-1">
              <MdLink size={18} className="-rotate-45" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
