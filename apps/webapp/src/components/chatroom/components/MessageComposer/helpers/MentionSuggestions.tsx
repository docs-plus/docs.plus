import { type ReactNode, type RefObject, useMemo } from 'react'

import { MentionSuggestionRow } from './MentionSuggestionRow'
import {
  isEveryone,
  MENTION_LISTBOX_ID,
  mentionOptionId,
  type MentionPickerEntry
} from './mentionTypes'

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-1">
      <div
        className="text-base-content/60 px-2 py-1 text-xs font-semibold tracking-wide uppercase"
        aria-hidden>
        {label}
      </div>
      {children}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="skeleton h-4 flex-1 rounded" />
        </div>
      ))}
    </>
  )
}

type IndexedEntry = { entry: MentionPickerEntry; index: number }

export type MentionSuggestionsProps = {
  flatEntries: MentionPickerEntry[]
  selectedIndex: number
  loading: boolean
  fetchError: boolean
  onlineByUserId: Map<string, boolean>
  listRef: RefObject<HTMLDivElement | null>
  onSelect: (index: number) => void
  onRowHover: (index: number) => void
}

export function MentionSuggestions({
  flatEntries,
  selectedIndex,
  loading,
  fetchError,
  onlineByUserId,
  listRef,
  onSelect,
  onRowHover
}: MentionSuggestionsProps): ReactNode {
  const { everyoneEntries, memberEntries } = useMemo(() => {
    const everyone: IndexedEntry[] = []
    const members: IndexedEntry[] = []
    flatEntries.forEach((entry, index) => {
      if (isEveryone(entry)) everyone.push({ entry, index })
      else members.push({ entry, index })
    })
    return { everyoneEntries: everyone, memberEntries: members }
  }, [flatEntries])

  const activeOptionId = flatEntries.length > 0 ? mentionOptionId(selectedIndex) : undefined

  const statusText = fetchError
    ? "Couldn't load members"
    : loading
      ? 'Loading members'
      : flatEntries.length === 0
        ? 'No members found'
        : `${flatEntries.length} ${flatEntries.length === 1 ? 'option' : 'options'}`

  return (
    <div
      ref={listRef}
      id={MENTION_LISTBOX_ID}
      role="listbox"
      aria-label="Mention members"
      aria-activedescendant={activeOptionId}
      className="max-h-[300px] overflow-y-auto p-1">
      <div role="status" aria-live="polite" className="sr-only">
        {statusText}
      </div>

      {loading && flatEntries.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <>
          {everyoneEntries.length > 0 && (
            <Section label="Notify">
              {everyoneEntries.map(({ entry, index }) => (
                <MentionSuggestionRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  optionId={mentionOptionId(index)}
                  selected={selectedIndex === index}
                  online={false}
                  onSelect={onSelect}
                  onMouseEnter={onRowHover}
                />
              ))}
            </Section>
          )}

          <Section label="Members">
            {fetchError ? (
              <div className="text-error px-2 py-3 text-sm">Couldn&apos;t load members</div>
            ) : loading && memberEntries.length === 0 ? (
              <LoadingSkeleton />
            ) : memberEntries.length > 0 ? (
              memberEntries.map(({ entry, index }) => (
                <MentionSuggestionRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  optionId={mentionOptionId(index)}
                  selected={selectedIndex === index}
                  online={onlineByUserId.get(entry.id) ?? false}
                  onSelect={onSelect}
                  onMouseEnter={onRowHover}
                />
              ))
            ) : (
              <div className="text-base-content/60 px-2 py-3 text-sm">No members found</div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
