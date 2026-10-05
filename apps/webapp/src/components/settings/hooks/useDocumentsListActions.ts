import * as toast from '@components/toast'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { OwnedDocument } from '../types'
import { useOwnerDocumentsCache } from './documentsCache'
import useDeleteDocument from './useDeleteDocument'

// One pending soft-delete at a time. `reinsert` comes from the cache and stays bound to the
// list the row left, which a search or sort change may have replaced.
type PendingDelete = {
  documentId: string
  title: string
  reinsert: () => void
}

const UNDO_WINDOW_MS = 6000

interface DocumentsListActionsInput {
  userId: string
  docs: OwnedDocument[]
}

export type DocumentsListActions = ReturnType<typeof useDocumentsListActions>

/**
 * The list owns roving focus and delete-with-Undo, not the row menu, which unmounts with
 * its row. Settings → Documents and the Home card share it.
 */
export function useDocumentsListActions({ userId, docs }: DocumentsListActionsInput) {
  const cache = useOwnerDocumentsCache(userId)
  const { deleteDocument, restoreDocument } = useDeleteDocument()

  // The timer auto-dismisses the banner (the soft-delete stands) after the window.
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(dismissTimerRef.current ?? undefined), [])

  // Roving tabindex: one tab stop per row or tile; arrows move the active item.
  const listRef = useRef<HTMLElement | null>(null)
  const bindListRef = (el: HTMLElement | null) => {
    listRef.current = el
  }
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    setActiveIndex((i) => (docs.length === 0 ? 0 : Math.min(i, docs.length - 1)))
  }, [docs.length])

  const focusRowAt = useCallback((index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-doc-row-button]')
    if (!buttons?.length) return
    const next = Math.max(0, Math.min(index, buttons.length - 1))
    setActiveIndex(next)
    buttons[next]?.focus()
  }, [])

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Only from a row nav button — never while the rename input (same <ul>) is focused.
    if (!(e.target as HTMLElement).matches('[data-doc-row-button]')) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusRowAt(activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusRowAt(activeIndex - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusRowAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusRowAt(docs.length - 1)
    }
  }

  // Optimistic soft-delete: drop the row, offer Undo (~6s), reconcile keyboard focus.
  // Not memoized — it must read this render's live docs, or the focus index is stale.
  const handleDelete = (documentId: string, keyboard: boolean) => {
    const delIndex = docs.findIndex((d) => d.documentId === documentId)

    void cache.removeDocument(documentId).then((outcome) => {
      if (!outcome) return

      // The ⋮ trigger unmounts, so the list (not the closing menu) lands focus on the
      // adjacent row; 100ms clears floating-ui's 80ms return-focus race.
      if (keyboard && delIndex !== -1) {
        setTimeout(() => focusRowAt(delIndex), 100)
      }

      // Replace the prior banner (one pending delete at a time) and arm auto-dismiss.
      clearTimeout(dismissTimerRef.current ?? undefined)
      setPendingDelete({
        documentId,
        title: outcome.removed.title ?? outcome.removed.slug,
        reinsert: outcome.reinsert
      })
      dismissTimerRef.current = setTimeout(() => setPendingDelete(null), UNDO_WINDOW_MS)

      deleteDocument(
        { documentId },
        {
          onError: () => {
            outcome.rollback()
            clearTimeout(dismissTimerRef.current ?? undefined)
            setPendingDelete(null)
            toast.Error('Couldn’t delete document')
          }
        }
      )
    })
  }

  // Undo: put the row back where it sat, then restore server-side.
  const handleUndo = () => {
    const pending = pendingDelete
    if (!pending) return
    clearTimeout(dismissTimerRef.current ?? undefined)
    setPendingDelete(null)
    pending.reinsert()
    restoreDocument(
      { documentId: pending.documentId },
      { onError: () => toast.Error('Couldn’t restore document') }
    )
  }

  return {
    bindListRef,
    activeIndex,
    setActiveIndex,
    handleListKeyDown,
    handleDelete,
    pendingDelete,
    handleUndo
  }
}
