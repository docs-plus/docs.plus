import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { useEffect, useMemo, useState } from 'react'

const STEP_BUTTON_CLASS =
  'btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-base-content focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset'

type PinnedRow = { id: string; content?: string | null; html?: string | null }

/** Multi-pin slider when more than one pin exists; single-pin channels hide controls. */
export const PinnedMessagesBar = ({
  channelId,
  onJumpToMessage
}: {
  channelId: string
  onJumpToMessage: (messageId: string) => Promise<void>
}) => {
  const channelPinned = useChatStore((s) => s.pinnedMessages.get(channelId))
  const pinned = useMemo<PinnedRow[]>(
    () => (channelPinned ? Array.from(channelPinned.values()) : []),
    [channelPinned]
  )
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
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
  // A pin outside the loaded window fetches it first. An in-window jump settles before paint.
  const onJump = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onJumpToMessage(current.id)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="border-base-300 bg-base-100 sticky top-0 z-30 flex items-center border-b"
      data-key="pinned-bar">
      {hasMany && (
        <button
          type="button"
          onClick={onPrev}
          className={STEP_BUTTON_CLASS}
          aria-label="Previous pinned message">
          <Icons.chevronUp size={16} />
        </button>
      )}
      <button
        key={current.id}
        type="button"
        onClick={() => void onJump()}
        aria-busy={busy || undefined}
        className="focus-visible:ring-primary block min-w-0 flex-1 truncate px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset">
        {current.content ?? ''}
      </button>
      {busy && <span className="loading loading-spinner loading-xs me-2 shrink-0" aria-hidden />}
      {hasMany && (
        <>
          <span className="text-base-content/60 px-1 text-xs tabular-nums">
            {index + 1}/{pinned.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            className={STEP_BUTTON_CLASS}
            aria-label="Next pinned message">
            <Icons.chevronDown size={16} />
          </button>
        </>
      )}
    </div>
  )
}
