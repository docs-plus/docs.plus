import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { useStore } from '@stores'
import { type InfiniteData, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { LuArrowLeft, LuRotateCcw, LuTrash2, LuX } from 'react-icons/lu'

import { makeTrashKey } from '../documentsQueryKey'
import useDeleteDocument from '../hooks/useDeleteDocument'
import { useTrashedDocuments } from '../hooks/useTrashedDocuments'
import type { DocumentsPage, OwnedDocument } from '../types'
import DeleteForeverDialog from './DeleteForeverDialog'
import TrashListRow from './TrashListRow'

const TrashBodySkeleton = () => (
  <div className="divide-base-300 divide-y">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 py-3">
        <div className="skeleton size-[18px] shrink-0 rounded" />
        <div className="flex-1 space-y-2">
          <div className="skeleton rounded-field h-4 w-1/2" />
          <div className="skeleton rounded-field h-3 w-24" />
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
 * Trash sub-view of the Documents settings surface — the owner's soft-deleted
 * documents with a retention countdown, Restore, irreversible Delete-forever,
 * multi-select, and Empty trash. Owns its own infinite query (makeTrashKey) so
 * the live list's cache is never disturbed.
 */
const TrashSection = ({ userId, onBack }: TrashSectionProps) => {
  const queryClient = useQueryClient()
  const openDialog = useStore((state) => state.openDialog)
  const { restoreDocument, permanentlyDeleteDocument, purgeTrash, bulkRestoreDocuments } =
    useDeleteDocument()

  const key = makeTrashKey(userId)
  const { data, isLoading, isError, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } =
    useTrashedDocuments(userId)

  const docs = data?.pages.flatMap((p) => p.docs) ?? []
  const backRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

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

  // Optimistic remove reads the LIVE cache at click time (never a stale snapshot);
  // cancel in-flight refetches first (refetchOnMount/focus) or one can clobber it back.
  const removeManyOptimistically = async (ids: string[]) => {
    await queryClient.cancelQueries({ queryKey: key })
    const snapshot = queryClient.getQueryData<InfiniteData<DocumentsPage>>(key)
    const idSet = new Set(ids)
    if (snapshot) {
      // `total` is a global count replicated on every page (it feeds hasNextPage),
      // so decrement each page by the count removed across ALL pages — never the
      // per-page count, which would make the pages' totals diverge.
      const removedCount = snapshot.pages.reduce(
        (n, page) => n + page.docs.filter((d) => idSet.has(d.documentId)).length,
        0
      )
      queryClient.setQueryData<InfiniteData<DocumentsPage>>(key, {
        ...snapshot,
        pages: snapshot.pages.map((page) => ({
          ...page,
          total: Math.max(0, page.total - removedCount),
          docs: page.docs.filter((d) => !idSet.has(d.documentId))
        }))
      })
    }
    return snapshot
  }

  const rollback = (snapshot: InfiniteData<DocumentsPage> | undefined) => {
    if (snapshot) queryClient.setQueryData(key, snapshot)
  }

  const handleRestore = async (doc: OwnedDocument) => {
    const index = docs.findIndex((d) => d.documentId === doc.documentId)
    const snapshot = await removeManyOptimistically([doc.documentId])
    reconcileFocus(index, docs.length - 1)
    restoreDocument(
      { documentId: doc.documentId },
      {
        onSuccess: () => {
          // The doc is live again — refresh the main list (distinct key prefix)
          // and settle trash: the offset-based getNextPageParam can't survive a
          // row being filtered out, so invalidate to resync docs/total/hasNextPage.
          queryClient.invalidateQueries({ queryKey: ['documents', userId] })
          queryClient.invalidateQueries({ queryKey: key })
          toast.Success('Document restored')
        },
        onError: () => {
          rollback(snapshot)
          toast.Error('Couldn’t restore document')
        }
      }
    )
  }

  const confirmDeleteForever = async (doc: OwnedDocument) => {
    const index = docs.findIndex((d) => d.documentId === doc.documentId)
    const snapshot = await removeManyOptimistically([doc.documentId])
    // 100ms clears the dialog's floating-ui return-focus to the unmounted trigger.
    reconcileFocus(index, docs.length - 1, 100)
    permanentlyDeleteDocument(
      { documentId: doc.documentId },
      {
        onSuccess: () => {
          // Settle trash (offset-based pagination can't survive a filtered row).
          queryClient.invalidateQueries({ queryKey: key })
          toast.Success('Deleted forever')
        },
        onError: () => {
          rollback(snapshot)
          toast.Error('Couldn’t delete document')
        }
      }
    )
  }

  const handleDeleteForever = (doc: OwnedDocument) => {
    const label = doc.title ?? doc.slug
    openDialog(
      <DeleteForeverDialog
        body={`Delete “${label}” forever? This permanently removes the document and everything in it and can’t be undone.`}
        onConfirm={() => confirmDeleteForever(doc)}
      />,
      { size: 'sm', align: 'top', className: 'mt-14' }
    )
  }

  const handleBulkRestore = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const snapshot = await removeManyOptimistically(ids)
    clearSelection()
    bulkRestoreDocuments(
      { ids },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: ['documents', userId] })
          queryClient.invalidateQueries({ queryKey: key })
          toast.Success(
            res.restored === 1 ? 'Document restored' : `${res.restored} documents restored`
          )
        },
        onError: () => {
          rollback(snapshot)
          toast.Error('Couldn’t restore documents')
        }
      }
    )
  }

  const runBulkDeleteForever = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const snapshot = await removeManyOptimistically(ids)
    clearSelection()
    purgeTrash(
      { ids },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: key })
          toast.Success(res.purged === 1 ? 'Deleted forever' : `${res.purged} documents deleted`)
        },
        onError: () => {
          rollback(snapshot)
          toast.Error('Couldn’t delete documents')
        }
      }
    )
  }

  const handleBulkDeleteForever = () => {
    const n = selectedCount
    openDialog(
      <DeleteForeverDialog
        heading={n === 1 ? 'Delete forever?' : `Delete ${n} items forever?`}
        body={`Permanently delete ${
          n === 1 ? 'this document' : `these ${n} documents`
        } and everything in ${n === 1 ? 'it' : 'them'}? This can’t be undone.`}
        onConfirm={runBulkDeleteForever}
      />,
      { size: 'sm', align: 'top', className: 'mt-14' }
    )
  }

  const runEmptyTrash = async () => {
    const snapshot = await removeManyOptimistically(docs.map((d) => d.documentId))
    clearSelection()
    purgeTrash(
      {},
      {
        onSuccess: (res) => {
          // Empty-all can span unloaded pages — resync to the true (empty) state.
          queryClient.invalidateQueries({ queryKey: key })
          toast.Success(res.purged === 1 ? 'Deleted forever' : `${res.purged} documents deleted`)
        },
        onError: () => {
          rollback(snapshot)
          toast.Error('Couldn’t empty trash')
        }
      }
    )
  }

  const handleEmptyTrash = () => {
    // The true trash count (global `total`, replicated per page) — not just the
    // loaded rows, since empty-all purges every page server-side.
    const n = data?.pages[0]?.total ?? docs.length
    openDialog(
      <DeleteForeverDialog
        heading="Empty trash?"
        confirmLabel="Empty trash"
        body={`Permanently delete all ${n} ${
          n === 1 ? 'item' : 'items'
        } in trash? This removes each document and everything in it and can’t be undone.`}
        onConfirm={runEmptyTrash}
      />,
      { size: 'sm', align: 'top', className: 'mt-14' }
    )
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
            className="text-base-content/60 hover:bg-base-200 hover:text-base-content rounded-field inline-flex size-8 items-center justify-center transition-colors">
            <LuArrowLeft size={18} />
          </button>
          <h3 className="text-base-content font-medium">Trash</h3>
          <span className="flex-1" />
          {!selectionActive && docs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              startIcon={LuTrash2}
              className="text-error/80 hover:bg-error/10 hover:text-error"
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
              size="sm"
              variant="ghost"
              startIcon={LuRotateCcw}
              className="text-primary hover:bg-primary/10"
              onClick={handleBulkRestore}>
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              startIcon={LuTrash2}
              className="text-error hover:bg-error/10"
              onClick={handleBulkDeleteForever}>
              Delete forever
            </Button>
          </div>
        ) : (
          <p className="text-base-content/50 pl-10 text-xs">
            Items in trash are removed permanently after 30 days.
          </p>
        )}
      </div>

      {isLoading ? (
        <TrashBodySkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-base-content text-sm font-medium">Couldn’t load trash</p>
          <Button
            size="sm"
            variant="ghost"
            className="border-base-300 mt-4 border"
            onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
            <LuTrash2 size={24} className="text-base-content/40" />
          </div>
          <p className="text-base-content text-sm font-medium">Trash is empty.</p>
        </div>
      ) : (
        <div>
          <div className="border-base-300 flex items-center gap-3 border-b px-2 pb-2">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Select all"
              className="checkbox checkbox-sm checkbox-primary shrink-0"
            />
            <span className="text-base-content/50 text-xs">Select all</span>
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
              <Button
                size="sm"
                variant="ghost"
                className="border-base-300 border"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}>
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
