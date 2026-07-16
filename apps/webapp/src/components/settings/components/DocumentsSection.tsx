import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import Select, { type SelectOption } from '@components/ui/Select'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { supabaseClient } from '@utils/supabase'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LuFileText, LuLayoutGrid, LuList, LuSearch, LuTrash2, LuX } from 'react-icons/lu'

import { makeDocumentsKey } from '../documentsQueryKey'
import useDeleteDocument from '../hooks/useDeleteDocument'
import { useDocumentMembers } from '../hooks/useDocumentMembers'
import type { DocumentSortKey, DocumentsPage, OwnedDocument } from '../types'
import DocumentGridTile from './DocumentGridTile'
import DocumentListRow from './DocumentListRow'
import SettingsCard from './SettingsCard'
import TrashSection from './TrashSection'

type DocumentViewMode = 'list' | 'grid'

// One pending soft-delete at a time: the removed doc + its restore slot, for the in-modal Undo
// banner. Rendered inline (not a toast) so Undo stays clickable inside the Settings modal scrim.
type PendingDelete = {
  documentId: string
  title: string
  key: ReturnType<typeof makeDocumentsKey>
  removedDoc: OwnedDocument
  pageIndex: number
  indexInPage: number
}

const UNDO_WINDOW_MS = 6000

const ITEMS_PER_PAGE = 20

// Sort labels map 1:1 to the backend `sort` enum; server-side only (client sort breaks Load more).
const SORT_OPTIONS: SelectOption[] = [
  { value: 'updatedAt_desc', label: 'Last modified' },
  { value: 'createdAt_desc', label: 'Date created' },
  { value: 'title_asc', label: 'Name (A→Z)' },
  { value: 'title_desc', label: 'Name (Z→A)' }
]

const SORT_STORAGE_KEY = 'docsplus:my-docs-sort'
const VIEW_STORAGE_KEY = 'docsplus:my-docs-view'

async function fetchMyDocumentsPage(
  uid: string,
  pageParam: number,
  title: string,
  sort: DocumentSortKey
): Promise<DocumentsPage> {
  const params = new URLSearchParams({
    limit: String(ITEMS_PER_PAGE),
    offset: String(pageParam * ITEMS_PER_PAGE),
    ownerId: uid,
    sort
  })
  if (title) params.set('title', title)

  // Owner-scoped list requires the token so the backend can gate ownerId === token.sub.
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers.token = session.access_token

  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?${params}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`Failed to fetch documents: ${response.status}`)
  const json = await response.json()
  return json.data as DocumentsPage
}

const DocumentsBodySkeleton = ({ viewMode }: { viewMode: DocumentViewMode }) =>
  viewMode === 'grid' ? (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-base-300 rounded-box border">
          <div className="skeleton rounded-t-box aspect-[4/3]" />
          <div className="space-y-2 p-3">
            <div className="skeleton rounded-field h-4 w-3/4" />
            <div className="skeleton rounded-field h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="divide-base-300 divide-y">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="skeleton size-[18px] shrink-0 rounded" />
          <div className="skeleton rounded-field h-4 flex-1" />
          <div className="skeleton rounded-field hidden h-3 w-20 sm:block" />
        </div>
      ))}
    </div>
  )

interface DocumentsSectionProps {
  // Dismiss the Settings modal when a row/tile opens a doc.
  onOpenDocument?: () => void
}

const DocumentsSection = ({ onOpenDocument }: DocumentsSectionProps) => {
  const userId = useAuthStore((state) => state.profile?.id)
  const isAnonymous = useAuthStore((state) => state.isAnonymous)

  const sortLabelId = useId()

  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<DocumentSortKey>(() => {
    if (typeof window === 'undefined') return 'updatedAt_desc'
    const stored = window.sessionStorage.getItem(SORT_STORAGE_KEY)
    return SORT_OPTIONS.some((o) => o.value === stored)
      ? (stored as DocumentSortKey)
      : 'updatedAt_desc'
  })
  const [viewMode, setViewMode] = useState<DocumentViewMode>(() => {
    if (typeof window === 'undefined') return 'list'
    return window.sessionStorage.getItem(VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list'
  })
  // Trash is a sub-view of this same card: swaps the whole body, not a nav tab.
  const [showTrash, setShowTrash] = useState(false)

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 350),
    []
  )
  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    debouncedSetSearch(e.target.value)
  }

  const clearSearch = () => {
    debouncedSetSearch.cancel()
    setInputValue('')
    setSearchQuery('')
  }

  const handleSortChange = (value: string) => {
    setSortKey(value as DocumentSortKey)
    if (typeof window !== 'undefined') window.sessionStorage.setItem(SORT_STORAGE_KEY, value)
  }

  const handleViewChange = (mode: DocumentViewMode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined') window.sessionStorage.setItem(VIEW_STORAGE_KEY, mode)
  }

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch
  } = useInfiniteQuery({
    // The menu's optimistic patch keys on the exact same 4-tuple (via makeDocumentsKey);
    // feed the DEBOUNCED searchQuery here, never inputValue, or the patch no-ops.
    queryKey: makeDocumentsKey(userId ?? '', searchQuery, sortKey),
    enabled: !!userId && !isAnonymous,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchMyDocumentsPage(userId!, pageParam, searchQuery, sortKey),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const nextOffset = (lastPageParam + 1) * ITEMS_PER_PAGE
      return nextOffset < lastPage.total ? lastPageParam + 1 : undefined
    }
  })

  const docs = data?.pages.flatMap((p) => p.docs) ?? []
  const total = data?.pages[0]?.total ?? 0

  // One batched member-preview fetch for the whole visible page; each row reads its slug.
  const { data: membersMap } = useDocumentMembers(docs.map((d) => d.slug))

  const queryClient = useQueryClient()
  const { deleteDocument, restoreDocument } = useDeleteDocument()

  // In-modal Undo banner state; the timer auto-dismisses (soft-delete stands) after the window.
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(dismissTimerRef.current ?? undefined), [])

  // Roving tabindex: one tab stop per list row; arrows move the active row.
  const listRef = useRef<HTMLUListElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    setActiveIndex((i) => (docs.length === 0 ? 0 : Math.min(i, docs.length - 1)))
  }, [docs.length])

  const focusRowAt = useCallback((index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-doc-row-button]')
    if (!buttons?.length) return
    buttons[Math.max(0, Math.min(index, buttons.length - 1))]?.focus()
  }, [])

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
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

  // Optimistic soft-delete: filter the row out, offer Undo (~6s), reconcile keyboard focus.
  // Not memoized — it must read this render's key tuple + live docs, or the patch no-ops.
  const handleDelete = (documentId: string, keyboard: boolean) => {
    const key = makeDocumentsKey(userId ?? '', searchQuery, sortKey)
    const delIndex = docs.findIndex((d) => d.documentId === documentId)

    void queryClient.cancelQueries({ queryKey: key }).then(() => {
      const snapshot = queryClient.getQueryData<InfiniteData<DocumentsPage>>(key)
      if (!snapshot) return

      let removed: OwnedDocument | undefined
      let pageIndex = 0
      let indexInPage = 0
      snapshot.pages.forEach((page, pi) => {
        const idx = page.docs.findIndex((d) => d.documentId === documentId)
        if (idx !== -1) {
          removed = page.docs[idx]
          pageIndex = pi
          indexInPage = idx
        }
      })
      if (!removed) return
      const removedDoc = removed

      queryClient.setQueryData<InfiniteData<DocumentsPage>>(key, {
        ...snapshot,
        pages: snapshot.pages.map((page) => ({
          ...page,
          total: Math.max(0, page.total - 1),
          docs: page.docs.filter((d) => d.documentId !== documentId)
        }))
      })

      // The ⋮ trigger unmounts, so the section (not the closing menu) lands focus on the
      // adjacent row; 100ms clears floating-ui's 80ms return-focus race. Browser-pending.
      if (keyboard && viewMode === 'list' && delIndex !== -1) {
        setTimeout(() => focusRowAt(delIndex), 100)
      }

      // Replace the prior banner (one pending delete at a time) and arm auto-dismiss.
      clearTimeout(dismissTimerRef.current ?? undefined)
      setPendingDelete({
        documentId,
        title: removedDoc.title ?? removedDoc.slug,
        key,
        removedDoc,
        pageIndex,
        indexInPage
      })
      dismissTimerRef.current = setTimeout(() => setPendingDelete(null), UNDO_WINDOW_MS)

      deleteDocument(
        { documentId },
        {
          onError: () => {
            queryClient.setQueryData(key, snapshot)
            clearTimeout(dismissTimerRef.current ?? undefined)
            setPendingDelete(null)
            toast.Error('Couldn’t delete document')
          }
        }
      )
    })
  }

  // Undo: re-read the live cache, splice the doc back at its slot, then restore server-side.
  const handleUndo = () => {
    const pending = pendingDelete
    if (!pending) return
    clearTimeout(dismissTimerRef.current ?? undefined)
    setPendingDelete(null)

    const { documentId, key, removedDoc, pageIndex, indexInPage } = pending
    const current = queryClient.getQueryData<InfiniteData<DocumentsPage>>(key)
    if (current) {
      queryClient.setQueryData<InfiniteData<DocumentsPage>>(key, {
        ...current,
        pages: current.pages.map((page, pi) => ({
          ...page,
          total: page.total + 1,
          docs:
            pi === pageIndex
              ? [...page.docs.slice(0, indexInPage), removedDoc, ...page.docs.slice(indexInPage)]
              : page.docs
        }))
      })
    }
    restoreDocument({ documentId }, { onError: () => toast.Error('Couldn’t restore document') })
  }

  if (!userId || isAnonymous) {
    return (
      <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
        <SettingsCard>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
              <LuFileText size={24} className="text-base-content/40" />
            </div>
            <p className="text-base-content text-sm font-medium">Sign in to see your documents.</p>
            <Button variant="primary" className="mt-4" onClick={() => openInlineSignInDialog()}>
              Sign in
            </Button>
          </div>
        </SettingsCard>
      </div>
    )
  }

  return (
    <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
      <SettingsCard>
        {showTrash ? (
          <TrashSection userId={userId} onBack={() => setShowTrash(false)} />
        ) : (
          <div className="space-y-4">
            {pendingDelete && (
              <div
                role="status"
                className="bg-base-200 rounded-field flex items-center justify-between gap-3 px-3 py-2 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
                <span className="text-base-content/70 truncate text-sm">
                  Deleted “{pendingDelete.title}”
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary hover:bg-primary/10 shrink-0"
                  onClick={handleUndo}>
                  Undo
                </Button>
              </div>
            )}

            <TextInput
              aria-label="Search documents"
              startIcon={LuSearch}
              endIcon={
                inputValue ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="text-base-content/50 hover:text-base-content -mr-1 flex size-6 items-center justify-center">
                    <LuX size={16} />
                  </button>
                ) : undefined
              }
              placeholder="Search documents"
              value={inputValue}
              onChange={handleSearch}
            />

            <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
              <label htmlFor={sortLabelId} className="sr-only">
                Sort documents
              </label>
              <Select
                id={sortLabelId}
                size="sm"
                value={sortKey}
                onChange={handleSortChange}
                options={SORT_OPTIONS}
                wrapperClassName="min-w-0 flex-1 sm:w-40 sm:flex-none sm:shrink-0"
                className="min-h-11 sm:min-h-8"
              />

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  startIcon={LuTrash2}
                  aria-label="Trash"
                  className="text-base-content/60 hover:text-base-content min-h-11 min-w-11 shrink-0 sm:min-h-9 sm:min-w-0 sm:px-3"
                  onClick={() => setShowTrash(true)}>
                  <span className="hidden sm:inline">Trash</span>
                </Button>

                <div className="join shrink-0" role="radiogroup" aria-label="View layout">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={viewMode === 'list'}
                    aria-label="List view"
                    onClick={() => handleViewChange('list')}
                    className={`join-item btn btn-sm min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 ${
                      viewMode === 'list'
                        ? 'btn-primary'
                        : 'btn-ghost border-base-300 text-base-content/60 border'
                    }`}>
                    <LuList size={16} />
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={viewMode === 'grid'}
                    aria-label="Grid view"
                    onClick={() => handleViewChange('grid')}
                    className={`join-item btn btn-sm min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 ${
                      viewMode === 'grid'
                        ? 'btn-primary'
                        : 'btn-ghost border-base-300 text-base-content/60 border'
                    }`}>
                    <LuLayoutGrid size={16} />
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <DocumentsBodySkeleton viewMode={viewMode} />
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-base-content text-sm font-medium">Couldn’t load documents</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="border-base-300 mt-4 border"
                  onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : docs.length === 0 ? (
              searchQuery ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-base-content text-sm font-medium">
                    No results for “{searchQuery}”
                  </p>
                  <p className="text-base-content/60 mt-1 text-xs">
                    Check spelling or try another title.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border-base-300 mt-4 border"
                    onClick={clearSearch}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
                    <LuFileText size={24} className="text-base-content/40" />
                  </div>
                  <p className="text-base-content text-sm font-medium">No documents yet</p>
                  <p className="text-base-content/60 mt-1 text-xs">
                    Documents you create will appear here.
                  </p>
                </div>
              )
            ) : (
              <div
                className={
                  isFetching && !isLoading ? 'transition-opacity motion-safe:opacity-60' : undefined
                }>
                <p aria-live="polite" className="sr-only">
                  {total} documents
                </p>

                {viewMode === 'list' ? (
                  <ul
                    ref={listRef}
                    role="list"
                    className="divide-base-300 divide-y"
                    onKeyDown={handleListKeyDown}>
                    {docs.map((doc, i) => (
                      <DocumentListRow
                        key={doc.documentId}
                        doc={doc}
                        userId={userId}
                        searchQuery={searchQuery}
                        sortKey={sortKey}
                        members={membersMap?.get(doc.slug)}
                        onOpenDocument={onOpenDocument}
                        index={i}
                        isActive={i === activeIndex}
                        onActivate={setActiveIndex}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                    {docs.map((doc) => (
                      <DocumentGridTile
                        key={doc.documentId}
                        doc={doc}
                        userId={userId}
                        searchQuery={searchQuery}
                        sortKey={sortKey}
                        members={membersMap?.get(doc.slug)}
                        onOpenDocument={onOpenDocument}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}

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
        )}
      </SettingsCard>
    </div>
  )
}

export default DocumentsSection
