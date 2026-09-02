import { getCachedProsemirrorFromHistoryYdoc } from '@components/pages/history/historyDecodeCache'
import type { HistoryAuthorship } from '@components/pages/history/types'
import { buildAuthorRoster } from '@components/pages/history/utils/authorRoster'
import { collectBlockClientIds } from '@components/pages/history/utils/blockAuthors'
import { useStore } from '@stores'
import { useMemo } from 'react'

export const useHistoryAuthorship = (): HistoryAuthorship => {
  const activeHistory = useStore((state) => state.activeHistory)
  const clientAuthors = useStore((state) => state.clientAuthors)

  const version = activeHistory?.version
  const data = activeHistory?.data

  // Keyed on the bytes, not on the bindings. A `document:saved` silent refresh
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

  // Fresh object per render would recompute block ranges and dispatch every render.
  // Three arms: a list row has no `data` until watch lands. Calling that gap
  // unaligned would show a zero-coverage roster for content we simply lack.
  return useMemo(() => {
    if (data == null) return { status: 'pending' }
    if (!walk || !roster) return { status: 'unaligned' }
    return { status: 'ready', roster, types: walk.types }
  }, [data, roster, walk])
}
