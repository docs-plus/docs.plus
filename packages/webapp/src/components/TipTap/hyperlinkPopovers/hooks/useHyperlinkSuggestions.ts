import { getUserBookmarks } from '@api'
import { useStore } from '@stores'
import { useQuery } from '@tanstack/react-query'
import { type TBookmarkWithMessage } from '@types'
import { logger } from '@utils/logger'
import { useEffect, useMemo, useState } from 'react'

import type {
  BookmarkSuggestion,
  HeadingSuggestion,
  UseHyperlinkSuggestionsArgs,
  UseHyperlinkSuggestionsResult
} from '../types'
import { collectHeadings } from '../utils/collectHeadings'
import { filterSuggestions } from './filterSuggestions'

const BOOKMARK_STALE_MS = 60_000

/** Headings (live walk) + bookmarks (cached, gated by `disabled`) merged through the search filter. Bookmark RPC errors hide the section but keep headings working. */
export function useHyperlinkSuggestions({
  editor,
  query,
  disabled = false
}: UseHyperlinkSuggestionsArgs): UseHyperlinkSuggestionsResult {
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const [headings, setHeadings] = useState<HeadingSuggestion[]>([])

  // Headings are O(doc) to collect; skip the walk while the desktop picker is collapsed.
  useEffect(() => {
    if (disabled) {
      setHeadings([])
      return
    }

    setHeadings(collectHeadings(editor))
    const update = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (editor.isDestroyed) return
      if (!transaction.docChanged) return
      setHeadings(collectHeadings(editor))
    }
    editor.on('transaction', update)
    return () => {
      editor.off('transaction', update)
    }
  }, [editor, disabled])

  const queriesEnabled = Boolean(workspaceId) && !disabled

  const active = useQuery({
    queryKey: ['hl-bookmarks', workspaceId, 'active'],
    queryFn: async () => {
      const { data, error } = await getUserBookmarks({ workspaceId, archived: false })
      if (error) {
        logger.error('useHyperlinkSuggestions: failed to load active bookmarks', error)
        throw error
      }
      return data ?? []
    },
    enabled: queriesEnabled,
    staleTime: BOOKMARK_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1
  })

  const archived = useQuery({
    queryKey: ['hl-bookmarks', workspaceId, 'archived'],
    queryFn: async () => {
      const { data, error } = await getUserBookmarks({ workspaceId, archived: true })
      if (error) {
        logger.error('useHyperlinkSuggestions: failed to load archived bookmarks', error)
        throw error
      }
      return data ?? []
    },
    enabled: queriesEnabled,
    staleTime: BOOKMARK_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1
  })

  const bookmarks = useMemo<BookmarkSuggestion[]>(() => {
    // Supabase RPC returns a flat row array at runtime even though the
    // generated `PostgrestResponse<T[]>` types it as nested.
    const activeRows = (active.data ?? []) as unknown as TBookmarkWithMessage[]
    const archivedRows = (archived.data ?? []) as unknown as TBookmarkWithMessage[]
    const rows: TBookmarkWithMessage[] = [...activeRows, ...archivedRows]
    const mapped = rows.map(
      (row): BookmarkSuggestion => ({
        kind: 'bookmark',
        id: String(row.bookmark_id),
        title: (row.message_content ?? '').slice(0, 120),
        messageId: row.message_id,
        channelId: row.message_channel_id,
        archived: row.bookmark_archived_at !== null,
        createdAt: row.bookmark_created_at
      })
    )
    return mapped.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })
  }, [active.data, archived.data])

  const filtered = useMemo(
    () => filterSuggestions({ query, headings, bookmarks }),
    [query, headings, bookmarks]
  )

  return {
    headings: filtered.headings,
    bookmarks: filtered.bookmarks,
    isLoading: (active.isLoading || archived.isLoading) && !active.data && !archived.data,
    isError: active.isError || archived.isError
  }
}
