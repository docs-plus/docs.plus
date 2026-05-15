import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { useEffect, useMemo, useState } from 'react'

type PinnedRow = { id: string; content?: string | null; html?: string | null }

/**
 * Restores v1 multi-pin UX: when more than one pin exists, the bar shows
 * a prev/next slider with a 1-based "n / total" counter. Clicking the
 * pin body still jumps to the source message. Single-pin channels skip
 * the controls entirely.
 */
export const PinnedMessagesBar = ({
  channelId,
  onJumpToMessage
}: {
  channelId: string
  onJumpToMessage: (messageId: string) => void
}) => {
  const channelPinned = useChatStore((s) => s.pinnedMessages.get(channelId))
  const pinned = useMemo<PinnedRow[]>(
    () => (channelPinned ? Array.from(channelPinned.values()) : []),
    [channelPinned]
  )
  const [index, setIndex] = useState(0)
  // Clamp the index when the underlying list shrinks (unpin from another
  // tab, etc.); otherwise the user lands on an empty slot.
  useEffect(() => {
    if (index >= pinned.length) setIndex(Math.max(0, pinned.length - 1))
  }, [pinned.length, index])
  if (pinned.length === 0) return null
  const current = pinned[Math.min(index, pinned.length - 1)]
  const hasMany = pinned.length > 1
  const onPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i - 1 + pinned.length) % pinned.length)
  }
  const onNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i + 1) % pinned.length)
  }
  return (
    <div
      className="border-base-200 bg-base-100 sticky top-0 z-30 flex items-center border-b"
      data-key="pinned-bar">
      {hasMany && (
        <button
          type="button"
          onClick={onPrev}
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Previous pinned message">
          <Icons.chevronUp size={16} />
        </button>
      )}
      <button
        key={current.id}
        onClick={() => onJumpToMessage(current.id)}
        className="block min-w-0 flex-1 truncate px-3 py-2 text-left">
        {current.content ?? ''}
      </button>
      {hasMany && (
        <>
          <span className="text-base-content/60 px-1 font-mono text-xs">
            {index + 1}/{pinned.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            className="btn btn-ghost btn-xs btn-square"
            aria-label="Next pinned message">
            <Icons.chevronDown size={16} />
          </button>
        </>
      )}
    </div>
  )
}
