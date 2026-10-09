import * as toast from '@components/toast'
import Button, { dangerGhostClassName } from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import { useEffect, useId, useRef, useState } from 'react'
import { LuArrowLeft, LuRotateCcw, LuTrash2, LuX } from 'react-icons/lu'

import { useTrashCache } from '../hooks/documentsCache'
import useDeleteDocument from '../hooks/useDeleteDocument'
import { useTrashedDocuments } from '../hooks/useTrashedDocuments'
import { openDeleteForeverConfirm } from '../openDeleteForeverConfirm'
import type { OwnedDocument } from '../types'
import TrashListRow from './TrashListRow'

const TrashBodySkeleton = () => (
  <div className="divide-base-300 divide-y">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 py-3">
        <div className="skeleton size-[18px] shrink-0 rounded" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton rounded-field h-8 w-20" />
      </div>
    ))}
  </div>
)

interface TrashSectionProps {
  userId: string
  onBack: () => void
}

/**
 * Trash sub-view of the Documents settings surface. Its own infinite query and its own
 * cache key, so the Owner live list is never disturbed except where a restore says so.
 */
const TrashSection = ({ userId, onBack }: TrashSectionProps) => {
  const cache = useTrashCache(userId)
  const { restoreDocument, permanentlyDeleteDocument, purgeTrash, bulkRestoreDocuments } =
    useDeleteDocument()

  const { data, isLoading, isError, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } =
    useTrashedDocuments(userId)

  const docs = data?.pages.flatMap((p) => p.docs) ?? []
  const backRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const selectAllId = useId()

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const selectedCount = selected.size
  const selectionActive = selectedCount > 0
  const allSelected = docs.length > 0 && selectedCount === docs.length

  // Drop selected ids that vanished from the list (reaped, restored elsewhere, a
  // page reset). Keyed on `data` — the derived `docs` array is new every render.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const live = new Set((data?.pages.flatMap((p) => p.docs) ?? []).map((d) => d.documentId))
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [data])

  // Native `indeterminate` isn't an attribute — set it on the DOM node.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectionActive && !allSelected
  }, [selectionActive, allSelected])

  const toggleSelect = (doc: OwnedDocument) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(doc.documentId)) next.delete(doc.documentId)
      else next.add(doc.documentId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === docs.length ? new Set() : new Set(docs.map((d) => d.documentId))
    )
  }

  const clearSelection = () => {
    setSelected(new Set())
    requestAnimationFrame(() => backRef.current?.focus())
  }

  // After a row unmounts, focus falls to <body>; move it to the next action (or
  // Back when the list empties). The dialog path needs 100ms to clear floating-ui's
  // return-focus to the now-unmounted trigger; the direct (Restore) path uses rAF.
  const reconcileFocus = (removedIndex: number, remaining: number, delayMs?: number) => {
    const run = () => {
      if (remaining === 0) {
        backRef.current?.focus()
        return
      }
      const actions = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-trash-action]')
      const next = actions?.[Math.min(removedIndex, actions.length - 1)]
      next?.focus()
    }
    if (delayMs) setTimeout(run, delayMs)
    else requestAnimationFrame(run)
  }

  const handleRestore = async (doc: OwnedDocument) => {
    const index = docs.findIndex((d) => d.documentId === doc.documentId)
    const rollback = await cache.removeDocuments([doc.documentId])
    reconcileFocus(index, docs.length - 1)
    restoreDocument(
      { documentId: doc.documentId },
      {
        onSuccess: () => {
          cache.resyncOwnerList()
          toast.Success('Document restored')
        },
        onError: () => {
          rollback?.()
          toast.Error('Couldn’t restore document')
        }
      }
    )
  }

  const confirmDeleteForever = async (doc: OwnedDocument) => {
    const index = docs.findIndex((d) => d.documentId === doc.documentId)
    const rollback = await cache.removeDocuments([doc.documentId])
    // 100ms clears the dialog's floating-ui return-focus to the unmounted trigger.
    reconcileFocus(index, docs.length - 1, 100)
    permanentlyDeleteDocument(
      { documentId: doc.documentId },
      {
        onSuccess: () => {
          toast.Success('Deleted forever')
        },
        onError: () => {
          rollback?.()
          toast.Error('Couldn’t delete document')
        }
      }
    )
  }

  const handleDeleteForever = (doc: OwnedDocument) => {
    const label = doc.title ?? doc.slug
    openDeleteForeverConfirm({
      body: (
        <>
          Delete “<bdi>{label}</bdi>” forever? This permanently removes the document and everything
          in it and can’t be undone.
        </>
      ),
      onConfirm: () => confirmDeleteForever(doc)
    })
  }

  const handleBulkRestore = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const rollback = await cache.removeDocuments(ids)
    clearSelection()
    bulkRestoreDocuments(
      { ids },
      {
        onSuccess: (res) => {
          cache.resyncOwnerList()
          toast.Success(
            res.restored === 1 ? 'Document restored' : `${res.restored} documents restored`
          )
        },
        onError: () => {
          rollback?.()
          toast.Error('Couldn’t restore documents')
        }
      }
    )
  }

  const runBulkDeleteForever = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const rollback = await cache.removeDocuments(ids)
    clearSelection()
    purgeTrash(
      { ids },
      {
        onSuccess: (res) => {
          toast.Success(res.purged === 1 ? 'Deleted forever' : `${res.purged} documents deleted`)
        },
        onError: () => {
          rollback?.()
          toast.Error('Couldn’t delete documents')
        }
      }
    )
  }

  const handleBulkDeleteForever = () => {
    const n = selectedCount
    openDeleteForeverConfirm({
      title: n === 1 ? 'Delete forever?' : `Delete ${n} items forever?`,
      body: `Permanently delete ${
        n === 1 ? 'this document' : `these ${n} documents`
      } and everything in ${n === 1 ? 'it' : 'them'}? This can’t be undone.`,
      onConfirm: runBulkDeleteForever
    })
  }

  const runEmptyTrash = async () => {
    const rollback = await cache.removeDocuments(docs.map((d) => d.documentId))
    clearSelection()
    purgeTrash(
      {},
      {
        onSuccess: (res) => {
          // The only Trash write that is not a removal of loaded rows: it purges pages this
          // list never held, so only the server knows the new total.
          cache.resync()
          toast.Success(res.purged === 1 ? 'Deleted forever' : `${res.purged} documents deleted`)
        },
        onError: () => {
          rollback?.()
          toast.Error('Couldn’t empty trash')
        }
      }
    )
  }

  const handleEmptyTrash = () => {
    // The true trash count (global `total`, replicated per page) — not just the
    // loaded rows, since empty-all purges every page server-side.
    const n = data?.pages[0]?.total ?? docs.length
    openDeleteForeverConfirm({
      title: 'Empty trash?',
      confirmLabel: 'Empty trash',
      body: `Permanently delete all ${n} ${
        n === 1 ? 'item' : 'items'
      } in trash? This removes each document and everything in it and can’t be undone.`,
      onConfirm: runEmptyTrash
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            ref={backRef}
            type="button"
            onClick={onBack}
            aria-label="Back to documents"
            className="text-base-content/70 hover:bg-base-200 hover:text-base-content rounded-field focus-visible:ring-primary inline-flex size-8 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <LuArrowLeft size={20} className="stroke-[1.75]" />
          </button>
          <h3 className="text-base-content text-base font-semibold">Trash</h3>
          <span className="flex-1" />
          {!selectionActive && docs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              startIcon={LuTrash2}
              className={dangerGhostClassName}
              onClick={handleEmptyTrash}>
              Empty trash
            </Button>
          )}
        </div>

        {selectionActive ? (
          <div className="bg-primary/10 rounded-field flex items-center gap-2 px-2 py-1.5">
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="text-base-content/60 hover:bg-base-200 hover:text-base-content rounded-field inline-flex size-7 items-center justify-center transition-colors">
              <LuX size={16} />
            </button>
            <span className="text-base-content text-sm font-medium">{selectedCount} selected</span>
            <span className="flex-1" />
            <Button
              variant="quiet"
              startIcon={LuRotateCcw}
              className="me-1"
              onClick={handleBulkRestore}>
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              startIcon={LuTrash2}
              className={dangerGhostClassName}
              onClick={handleBulkDeleteForever}>
              Delete forever
            </Button>
          </div>
        ) : (
          <p className="text-meta text-base-content/60 pl-10">
            Items in trash are removed permanently after 30 days.
          </p>
        )}
      </div>

      {isLoading ? (
        <TrashBodySkeleton />
      ) : isError ? (
        <EmptyState tone="error" title="Couldn’t load trash." onRetry={refetch} />
      ) : docs.length === 0 ? (
        <EmptyState icon={LuTrash2} title="Trash is empty." />
      ) : (
        <div>
          <div className="border-base-300 flex items-center gap-3 border-b px-2 pb-2">
            <input
              ref={selectAllRef}
              id={selectAllId}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="checkbox checkbox-sm checkbox-primary shrink-0"
            />
            <label htmlFor={selectAllId} className="text-meta text-base-content/60 cursor-pointer">
              Select all
            </label>
          </div>
          <ul ref={listRef} role="list" className="divide-base-300 divide-y">
            {docs.map((doc) => (
              <TrashListRow
                key={doc.documentId}
                doc={doc}
                selected={selected.has(doc.documentId)}
                selectionActive={selectionActive}
                onToggleSelect={toggleSelect}
                onRestore={handleRestore}
                onDeleteForever={handleDeleteForever}
              />
            ))}
          </ul>

          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="quiet" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TrashSection
