import Button, { segmentClassName } from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import TextInput from '@components/ui/TextInput'
import { useNavigateToDocument } from '@hooks/useNavigateToDocument'
import { useAuthStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LuFileText, LuLayoutGrid, LuList, LuSearch, LuTrash2, LuX } from 'react-icons/lu'

import {
  DOCUMENTS_EMPTY_TEXT,
  DOCUMENTS_VIEW_STORAGE_KEY,
  type DocumentViewMode
} from '../constants'
import type { DocumentsListScope } from '../documentsQueryKey'
import { useDocumentsListActions } from '../hooks/useDocumentsListActions'
import { useDocumentsListPrefs } from '../hooks/useDocumentsListPrefs'
import { useOwnerDocuments } from '../hooks/useOwnerDocuments'
import { useTrashedDocuments } from '../hooks/useTrashedDocuments'
import { DocumentsBodySkeleton } from '../SettingsPanelSkeleton'
import DocumentsList from './DocumentsList'
import DocumentsListSelects from './DocumentsListSelects'
import DocumentUndoBanner from './DocumentUndoBanner'
import SettingsCard from './SettingsCard'
import TrashSection from './TrashSection'

const VIEW_OPTIONS = [
  { mode: 'list', icon: LuList, label: 'List view' },
  { mode: 'grid', icon: LuLayoutGrid, label: 'Grid view' }
] as const

interface DocumentsSectionProps {
  // Dismiss the Settings modal when a row/tile opens a doc.
  onOpenDocument?: () => void
}

const DocumentsSection = ({ onOpenDocument }: DocumentsSectionProps) => {
  const userId = useAuthStore((state) => state.profile?.id)

  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { listScope, sortKey } = useDocumentsListPrefs()
  const [viewMode, setViewMode] = useState<DocumentViewMode>(() => {
    if (typeof window === 'undefined') return 'list'
    return window.sessionStorage.getItem(DOCUMENTS_VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list'
  })
  // Trash is a sub-view of this same card: swaps the whole body, not a nav tab.
  const [showTrash, setShowTrash] = useState(false)
  // The entry shows only once the trash total is known and above 0, so it never flashes.
  const { data: trashData } = useTrashedDocuments(userId)
  const hasTrash = (trashData?.pages[0]?.total ?? 0) > 0
  const searchRef = useRef<HTMLInputElement>(null)
  // The last item left the trash (Empty trash, restore): go back to the list. The Trash
  // view unmounts with focus inside it, so move focus to search, not to the body.
  useEffect(() => {
    if (!hasTrash && showTrash) {
      setShowTrash(false)
      searchRef.current?.focus()
    }
  }, [hasTrash, showTrash])
  const { navigateToDocument, isLoading: isCreatingDocument } = useNavigateToDocument()

  // Same order as DocumentListRow open: navigate, then close the settings surface.
  const handleCreateDocument = () => {
    void navigateToDocument()
    onOpenDocument?.()
  }

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

  const handleViewChange = (mode: DocumentViewMode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined')
      window.sessionStorage.setItem(DOCUMENTS_VIEW_STORAGE_KEY, mode)
  }

  const scope: DocumentsListScope = {
    userId: userId ?? '',
    scope: listScope,
    searchQuery,
    sortKey
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
  } = useOwnerDocuments(scope)

  const docs = useMemo(() => data?.pages.flatMap((p) => p.docs) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0
  const listActions = useDocumentsListActions({ userId: scope.userId, docs })
  const { pendingDelete, handleUndo } = listActions

  // SettingsTakeover never renders without a profile; this only narrows the type.
  if (!userId) return null

  return (
    <div className="space-y-4 max-md:flex max-md:min-h-full max-md:flex-col">
      <SettingsCard className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
        {showTrash && hasTrash ? (
          <div className="max-md:min-h-0 max-md:flex-1 max-md:p-4">
            <TrashSection userId={userId} onBack={() => setShowTrash(false)} />
          </div>
        ) : (
          <div className="space-y-4 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:space-y-0">
            {pendingDelete && (
              <DocumentUndoBanner
                title={pendingDelete.title}
                onUndo={handleUndo}
                className="max-md:mx-4 max-md:mt-3"
              />
            )}

            <div className="max-md:border-base-300 max-md:bg-base-100 space-y-4 max-md:sticky max-md:top-0 max-md:z-10 max-md:space-y-2.5 max-md:border-b max-md:px-4 max-md:pt-3 max-md:pb-2.5">
              <TextInput
                ref={searchRef}
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

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <DocumentsListSelects />
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  {hasTrash && (
                    <Button
                      size="sm"
                      variant="ghost"
                      startIcon={LuTrash2}
                      iconSize={20}
                      aria-label="Trash"
                      className="text-base-content/60 hover:text-base-content min-h-11 min-w-11 shrink-0 sm:min-h-9 sm:min-w-0 sm:px-3"
                      onClick={() => setShowTrash(true)}>
                      <span className="hidden sm:inline">Trash</span>
                    </Button>
                  )}

                  <div className="join shrink-0" role="radiogroup" aria-label="View layout">
                    {VIEW_OPTIONS.map(({ mode, icon: Icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={viewMode === mode}
                        aria-label={label}
                        onClick={() => handleViewChange(mode)}
                        className={twMerge(
                          'join-item btn btn-sm btn-ghost min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
                          segmentClassName(viewMode === mode)
                        )}>
                        <Icon size={20} className="stroke-[1.75]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="max-md:px-4 max-md:pt-1">
                <DocumentsBodySkeleton viewMode={viewMode} />
              </div>
            ) : isError ? (
              <EmptyState
                tone="error"
                title="Couldn’t load documents."
                className="max-md:flex-1 max-md:justify-center"
                onRetry={refetch}
                retrying={isFetching}
              />
            ) : docs.length === 0 ? (
              searchQuery ? (
                <EmptyState
                  title={`No results for “${searchQuery}”.`}
                  body="Check spelling or try another title."
                  className="max-md:flex-1 max-md:justify-center"
                  action={
                    <Button variant="quiet" onClick={clearSearch}>
                      Clear search
                    </Button>
                  }
                />
              ) : listScope === 'joined' ? (
                <EmptyState
                  icon={LuFileText}
                  {...DOCUMENTS_EMPTY_TEXT.joined}
                  className="max-md:flex-1 max-md:justify-center"
                />
              ) : (
                <EmptyState
                  icon={LuFileText}
                  {...DOCUMENTS_EMPTY_TEXT.owned}
                  className="max-md:flex-1 max-md:justify-center"
                  action={
                    <Button
                      variant="primary"
                      loading={isCreatingDocument}
                      onClick={handleCreateDocument}>
                      Create document
                    </Button>
                  }
                />
              )
            ) : (
              <div
                className={twMerge(
                  'motion-safe:transition-opacity max-md:px-4 max-md:pt-1 max-md:pb-4',
                  isFetching && 'opacity-60'
                )}>
                <p aria-live="polite" className="sr-only">
                  {total} {total === 1 ? 'document' : 'documents'}
                </p>

                <DocumentsList
                  docs={docs}
                  viewMode={viewMode}
                  scope={scope}
                  actions={listActions}
                  onOpenDocument={onOpenDocument}
                />

                {hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="quiet"
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
