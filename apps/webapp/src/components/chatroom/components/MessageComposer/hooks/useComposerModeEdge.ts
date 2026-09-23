import type { TChannelSettings } from '@types'
import { useState } from 'react'

import type { ComposerModeEdge, ComposerModeKind } from '../types'

const composerModeKind = (memory: TChannelSettings | null): ComposerModeKind => {
  if (memory?.editMessageMemory) return 'edit'
  if (memory?.commentMessageMemory) return 'comment'
  if (memory?.replyMessageMemory) return 'reply'
  return 'none'
}

// Mount is an edge: closed unmounts the pane, and Close clears every mode and unmounts in one tick.
// Entering a mode never discards, because the failed-comment restore records its files again
// after the `await`.
export const composerModeEdgeAction = (
  from: ComposerModeKind | 'mount',
  to: ComposerModeKind
): ComposerModeEdge => {
  const draftLoad =
    to === 'edit'
      ? 'keep'
      : from === 'mount'
        ? 'fill'
        : from === 'edit' || from === 'comment'
          ? 'replace'
          : 'keep'
  const discardModeAdded =
    from === 'mount'
      ? to === 'none' || to === 'edit'
      : (from === 'reply' || from === 'comment') && to !== from

  return { to, draftLoad, discardModeAdded }
}

// The draft load reads reply as none, so a reply toggle never re-runs or cancels the load.
const draftKind = (kind: ComposerModeKind): ComposerModeKind => (kind === 'reply' ? 'none' : kind)

export const useComposerModeEdge = (memory: TChannelSettings | null) => {
  const kind = composerModeKind(memory)
  const [modeEdge, setModeEdge] = useState(() => composerModeEdgeAction('mount', kind))
  const [draftEdge, setDraftEdge] = useState(() => composerModeEdgeAction('mount', draftKind(kind)))
  if (modeEdge.to !== kind) setModeEdge(composerModeEdgeAction(modeEdge.to, kind))
  if (draftEdge.to !== draftKind(kind)) {
    setDraftEdge(composerModeEdgeAction(draftEdge.to, draftKind(kind)))
  }
  return { modeEdge, draftEdge }
}
