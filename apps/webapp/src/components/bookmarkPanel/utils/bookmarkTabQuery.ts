import { type TBookmarkTab } from '@types'

export const BOOKMARK_PAGE_SIZE = 10

export type BookmarkTabFetchParams = {
  archived: boolean
  markedAsRead: boolean | null
}

export function bookmarkTabFetchParams(tab: TBookmarkTab): BookmarkTabFetchParams {
  switch (tab) {
    case 'archive':
      return { archived: true, markedAsRead: null }
    case 'read':
      return { archived: false, markedAsRead: true }
    case 'in progress':
      return { archived: false, markedAsRead: false }
    default: {
      const _exhaustive: never = tab
      return _exhaustive
    }
  }
}
