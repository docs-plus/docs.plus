import { getCachedProsemirrorFromHistoryYdoc } from '@components/pages/history/historyDecodeCache'
import type { AuthorRoster } from '@components/pages/history/types'
import { buildAuthorRoster } from '@components/pages/history/utils/authorRoster'
import { collectBlockClientIds } from '@components/pages/history/utils/blockAuthors'
import { useStore } from '@stores'
import { useMemo } from 'react'

export type HistoryAuthorship =
  | { status: 'pending' }
  | { status: 'unaligned' }
  | { status: 'ready'; roster: AuthorRoster; types: string[] }

export const useHistoryAuthorship = (): HistoryAuthorship => {
  const activeHistory = useStore((state) => state.activeHistory)
  const clientAuthors = useStore((state) => state.clientAuthors)

  const version = activeHistory?.version
  const data = activeHistory?.data

  // Keyed on the bytes, not on the bindings: a `document:saved` silent refresh
  // replaces `clientAuthors` while the tab is open, and re-running Y.applyUpdate
  // over a whole snapshot for that would be wasted work.
  const walk = useMemo(() => {
    if (data == null || version == null) return null
    const json = getCachedProsemirrorFromHistoryYdoc(version, data) as {
      content?: { type?: string }[]
    } | null
    const content = json?.content
    if (!Array.isArray(content)) return null

    const clientIds = collectBlockClientIds(data, content.length)
    if (clientIds === null) return null

    return { clientIds, types: content.map((node) => node?.type ?? '') }
  }, [version, data])

  const roster = useMemo(
    () => (walk ? buildAuthorRoster(walk.clientIds, clientAuthors) : null),
    [walk, clientAuthors]
  )

  // Three arms, not two. A list row carries no `data`, so the gap between selecting
  // a version and its watch landing is a loading window — reporting it as unaligned
  // would show an authoritative zero-coverage roster for content we simply lack.
  if (data == null) return { status: 'pending' }
  if (!walk || !roster) return { status: 'unaligned' }
  return { status: 'ready', roster, types: walk.types }
}
