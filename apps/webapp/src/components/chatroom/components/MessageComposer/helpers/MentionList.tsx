import { searchWorkspaceUsers } from '@api'
import { useAuthStore, useStore } from '@stores'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import { MentionSuggestions } from './MentionSuggestions'
import {
  EVERYONE_ENTRY,
  type MentionPickerEntry,
  type MentionPickerUser,
  showEveryoneForQuery
} from './mentionTypes'

const DEBOUNCE_MS = 150

export type MentionListProps = {
  query: string
  command: (item: { id: string; label: string }) => void
}

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(function MentionList(
  { query, command },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [members, setMembers] = useState<MentionPickerUser[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const workspaceId = useStore((s) => s.settings.workspaceId)
  const usersPresence = useStore((s) => s.usersPresence)
  const currentUserId = useAuthStore((s) => s.profile?.id)

  const showEveryone = showEveryoneForQuery(query)

  const flatEntries = useMemo((): MentionPickerEntry[] => {
    const entries: MentionPickerEntry[] = []
    if (showEveryone) entries.push(EVERYONE_ENTRY)
    entries.push(...members)
    return entries
  }, [showEveryone, members])

  const onlineByUserId = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const [id, presence] of usersPresence) {
      map.set(id, presence.status === 'ONLINE')
    }
    return map
  }, [usersPresence])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    let cancelled = false

    if (!workspaceId || !currentUserId) {
      setMembers([])
      setLoading(false)
      setFetchError(false)
    } else {
      setLoading(true)
      setFetchError(false)
    }

    debounceRef.current = setTimeout(() => {
      if (!workspaceId || !currentUserId) {
        return
      }

      void searchWorkspaceUsers({ workspaceId, username: query })
        .then((res) => {
          if (cancelled) return
          if (res.error) {
            console.warn('[mention] fetch_mentioned_users error:', res.error)
            setMembers([])
            setFetchError(true)
            return
          }
          setFetchError(false)
          const rows = (Array.isArray(res.data) ? res.data : []) as MentionPickerUser[]
          setMembers(rows.filter((u) => u.id !== currentUserId))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, workspaceId, currentUserId])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    setSelectedIndex((i) => {
      if (flatEntries.length === 0) return 0
      return Math.min(i, flatEntries.length - 1)
    })
  }, [flatEntries.length])

  useEffect(() => {
    if (flatEntries.length === 0) return
    const entry = flatEntries[selectedIndex]
    if (!entry) return
    const el = listRef.current?.querySelector(`[data-mention-option-id="${CSS.escape(entry.id)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, flatEntries])

  const selectItem = (index: number) => {
    const item = flatEntries[index]
    if (!item) return
    command({ id: item.id, label: item.username })
  }

  const clampIndex = (next: number) => {
    if (flatEntries.length === 0) return 0
    return ((next % flatEntries.length) + flatEntries.length) % flatEntries.length
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => clampIndex(i - 1))
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => clampIndex(i + 1))
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    }
  }))

  return (
    <MentionSuggestions
      flatEntries={flatEntries}
      selectedIndex={selectedIndex}
      loading={loading}
      fetchError={fetchError}
      onlineByUserId={onlineByUserId}
      listRef={listRef}
      onSelect={selectItem}
      onRowHover={setSelectedIndex}
    />
  )
})

export default MentionList
