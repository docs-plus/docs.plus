import { useHistoryAuthorDecorations } from '@components/pages/history/hooks/useHistoryAuthorDecorations'
import { useHistoryAuthorship } from '@components/pages/history/hooks/useHistoryAuthorship'
import { useHistoryCompare } from '@components/pages/history/hooks/useHistoryCompare'
import type { AuthorRosterRow } from '@components/pages/history/types'
import { ANONYMOUS_KEY, UNRECORDED_KEY } from '@components/pages/history/utils/authorRoster'
import { buildBlockRanges } from '@components/pages/history/utils/blockAuthors'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useStore } from '@stores'
import type { VersionTrigger } from '@types'
import { resolveDisplayName } from '@utils/avatarFace'
import { prefersReducedMotion } from '@utils/motion'
import { useMemo, useState } from 'react'

const parts = (count: number) => `${count} ${count === 1 ? 'part' : 'parts'}`

/** Only the machine triggers that overwrite authorship earn a sentence. */
const TRIGGER_NOTE: Partial<Record<VersionTrigger, string>> = {
  revert: 'This version came from a restore, so its writers were not recorded.',
  'revert-backup': 'This version came from a restore, so its writers were not recorded.',
  api: 'This version came from the API, so its writers were not recorded.',
  'schema-migration': 'This version came from a schema migration, so its writers were not recorded.'
}

export function HistoryAuthorsBody() {
  const editor = useStore((state) => state.editor)
  const profiles = useStore((state) => state.profiles)
  const historyList = useStore((state) => state.historyList)
  const activeHistory = useStore((state) => state.activeHistory)
  const { compareMode, exitCompare } = useHistoryCompare()
  const authorship = useHistoryAuthorship()

  const [selection, setSelection] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Keyed on the version, not just `editor`. The editor identity is stable across
  // content changes, and `applyHistoryItemToEditor` runs synchronously in the stateless
  // handler before React re-renders. The version is what actually tracks the doc.
  const ranges = useMemo(
    () =>
      editor && authorship.status === 'ready'
        ? buildBlockRanges(editor.state.doc, authorship.types)
        : null,
    // `editor.state.doc` is read but is not a tracked value, so exhaustive-deps cannot
    // see that the version is what this depends on. Removing it returns stale ranges
    // and marks land on the previous version's blocks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, authorship, activeHistory?.version]
  )

  // Compare and authorship never paint together — two overlays on one read-only
  // editor are unreadable. One derived value drives both the radio and the marks.
  const activeSelection = compareMode ? null : selection

  const markedIndices = useMemo(() => {
    if (!activeSelection || authorship.status !== 'ready') return new Set<number>()
    return new Set(authorship.roster.blockIndicesByKey.get(activeSelection) ?? [])
  }, [activeSelection, authorship])

  useHistoryAuthorDecorations({
    ranges,
    markedIndices,
    focusedIndex,
    onBlockClick: setFocusedIndex
  })

  // Position within the selected person's parts, not within the document — "part 4 of
  // 317" answers a question nobody asked. The excerpt is what tells a screen-reader
  // user where they landed, because the mark itself is only visual.
  const announcement = useMemo(() => {
    if (focusedIndex == null || !activeSelection || authorship.status !== 'ready') return ''
    const indices = authorship.roster.blockIndicesByKey.get(activeSelection) ?? []
    const position = indices.indexOf(focusedIndex)
    if (position < 0) return ''
    const doc = editor?.state.doc
    const text =
      doc && focusedIndex < doc.childCount ? doc.child(focusedIndex).textContent.slice(0, 60) : ''
    return `Part ${position + 1} of ${indices.length}. ${text}`
  }, [focusedIndex, activeSelection, authorship, editor])

  const select = (key: string | null) => {
    if (key) exitCompare()
    setSelection(key)
    setFocusedIndex(null)
  }

  const step = (direction: 1 | -1) => {
    if (!activeSelection || authorship.status !== 'ready' || !ranges) return
    const indices = authorship.roster.blockIndicesByKey.get(activeSelection) ?? []
    const visible = indices.filter((index) => {
      const node = editor?.view.nodeDOM(ranges[index].from)
      return node instanceof HTMLElement && node.getClientRects().length > 0
    })
    if (visible.length === 0) return
    const current = focusedIndex == null ? -1 : visible.indexOf(focusedIndex)
    const next = visible[(current + direction + visible.length) % visible.length]
    setFocusedIndex(next)
    const node = editor?.view.nodeDOM(ranges[next].from)
    if (node instanceof HTMLElement) {
      node.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      })
    }
  }

  if (authorship.status === 'pending') {
    return <p className="text-base-content/60 px-3 py-4 text-sm">Loading this version…</p>
  }

  const trigger = historyList.find((item) => item.version === activeHistory?.version)?.trigger
  const triggerNote = trigger ? TRIGGER_NOTE[trigger] : undefined

  // `ranges === null` means the live doc's block types do not line up with the decoded
  // version, so nothing can be marked. Without this arm the panel renders a full roster
  // whose every control is dead, with no explanation.
  if (authorship.status === 'unaligned' || ranges === null || authorship.roster.knownCount === 0) {
    return (
      <div className="text-base-content/60 space-y-2 px-3 py-4 text-sm">
        <p>No writer information for this version.</p>
        {triggerNote && <p>{triggerNote}</p>}
      </div>
    )
  }

  const { roster } = authorship
  const focusedKeys = focusedIndex == null ? null : (roster.blockKeys[focusedIndex] ?? [])
  const selectable = roster.rows.filter((row) => row.kind !== 'unrecorded')
  const unrecorded = roster.rows.find((row) => row.kind === 'unrecorded')

  const rowLabel = (row: AuthorRosterRow) => {
    if (row.kind === 'anonymous') return `Not signed in — ${parts(row.count)}`
    const profile = row.userId ? profiles[row.userId] : undefined
    const name = profile ? (resolveDisplayName(profile) ?? 'Unnamed person') : 'Unnamed person'
    return `${name} — ${parts(row.count)}`
  }

  return (
    <div className="space-y-3 px-3 py-3">
      <p className="text-base-content/60 text-xs">
        This list shows whose text is still here. The Versions list shows who saved.
      </p>
      <p className="text-base-content/60 text-xs">
        {`${roster.knownCount} of ${parts(roster.totalCount)} ${roster.knownCount === 1 ? 'has' : 'have'} text from a known person.`}
      </p>

      <fieldset className="space-y-1">
        <legend className="sr-only">Show parts with text from</legend>

        <label className="hover:bg-base-200/60 rounded-field flex min-h-9 cursor-pointer items-center gap-2 px-2">
          <input
            type="radio"
            name="history-authors"
            className="radio radio-xs"
            checked={activeSelection === null}
            onChange={() => select(null)}
          />
          <span className="text-base-content/80 text-sm">None</span>
        </label>

        {selectable.map((row) => {
          const profile = row.userId ? profiles[row.userId] : undefined
          return (
            <label
              key={row.key}
              className="hover:bg-base-200/60 rounded-field flex min-h-9 cursor-pointer items-center gap-2 px-2">
              <input
                type="radio"
                name="history-authors"
                className="radio radio-xs"
                checked={activeSelection === row.key}
                onChange={() => select(row.key)}
              />
              {profile && (
                <Avatar face={profile} size="xs" clickable={false} className="shrink-0" />
              )}
              <span className="text-base-content/80 min-w-0 truncate text-sm">{rowLabel(row)}</span>
            </label>
          )
        })}
      </fieldset>

      {unrecorded && (
        <p className="text-base-content/60 px-2 text-xs">{`Not recorded — ${parts(unrecorded.count)}`}</p>
      )}
      {triggerNote && <p className="text-base-content/60 px-2 text-xs">{triggerNote}</p>}

      {activeSelection && (
        <div className="flex items-center gap-1.5 px-2">
          <Button variant="ghost" size="xs" onClick={() => step(-1)}>
            Previous part
          </Button>
          <Button variant="ghost" size="xs" onClick={() => step(1)}>
            Next part
          </Button>
        </div>
      )}

      {focusedKeys && (
        <p className="text-base-content/60 px-2 text-xs">
          {focusedKeys.length === 0
            ? 'No person recorded for this part.'
            : focusedKeys.includes(ANONYMOUS_KEY) && focusedKeys.length === 1
              ? 'Text here is from someone who was not signed in.'
              : `Text here is from ${focusedKeys
                  .filter((key) => key !== UNRECORDED_KEY)
                  .map((key) =>
                    key === ANONYMOUS_KEY
                      ? 'someone not signed in'
                      : (resolveDisplayName(profiles[key]) ?? 'Unnamed person')
                  )
                  .join(', ')}.`}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
