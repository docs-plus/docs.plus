import DocumentsList from '@components/settings/components/DocumentsList'
import DocumentsListSelects from '@components/settings/components/DocumentsListSelects'
import DocumentUndoBanner from '@components/settings/components/DocumentUndoBanner'
import { DOCUMENTS_EMPTY_TEXT } from '@components/settings/constants'
import type { DocumentsListScope } from '@components/settings/documentsQueryKey'
import { useDocumentsListActions } from '@components/settings/hooks/useDocumentsListActions'
import { useDocumentsListPrefs } from '@components/settings/hooks/useDocumentsListPrefs'
import { useOwnerDocuments } from '@components/settings/hooks/useOwnerDocuments'
import Button from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import { useNavigateToDocument } from '@hooks/useNavigateToDocument'
import { twMerge } from '@utils/twMerge'
import { useMemo, useState } from 'react'

import { isHomeMobileLayout } from './homeMobileLayout'

const HOME_DOCUMENTS_LIMIT = 8

type HomeCardInput = {
  hasPage: boolean
  isError: boolean
  /** The current pick has a real page with no rows. */
  isEmpty: boolean
  isNarrowed: boolean
  /** The Merged list total; undefined while its probe loads. */
  mergedTotal: number | undefined
  hasShownCard: boolean
  hasPendingDelete: boolean
}

/**
 * Hidden on the first load, on error and when the Merged list is empty. A card on screen
 * stays while the probe loads, and a pending Undo keeps it. A narrowed pick with no rows
 * shows the empty text, so the Show filter stays reachable.
 */
function homeCardState(input: HomeCardInput): 'hidden' | 'rows' | 'empty' {
  const { isEmpty, mergedTotal, hasShownCard } = input
  const isMergedEmpty =
    isEmpty && (mergedTotal === 0 || (mergedTotal === undefined && !hasShownCard))
  const isShown = (!input.isError && input.hasPage && !isMergedEmpty) || input.hasPendingDelete
  if (!isShown) return 'hidden'
  return isEmpty && input.isNarrowed ? 'empty' : 'rows'
}

interface HomeDocumentsProps {
  userId: string
  onSeeAll: () => void
}

/**
 * A short door into the Merged list, with the Settings rows, picks and Undo. `homeCardState`
 * keeps it hidden until a page lands, so the slug card never waits on it.
 */
export function HomeDocuments({ userId, onSeeAll }: HomeDocumentsProps) {
  const { listScope, sortKey } = useDocumentsListPrefs()
  const scope: DocumentsListScope = { userId, scope: listScope, searchQuery: '', sortKey }

  // Previous rows stay up while a new pick loads, so the Select never leaves the finger.
  const { data, isError, isPlaceholderData } = useOwnerDocuments(scope, {
    refetchOnWindowFocus: 'always',
    keepPrevious: true
  })
  const firstPage = data?.pages[0]
  const total = firstPage?.total ?? 0
  const rows = useMemo(() => firstPage?.docs.slice(0, HOME_DOCUMENTS_LIMIT) ?? [], [firstPage])

  // A placeholder page belongs to the previous pick, so only a real page can say "empty".
  const isEmpty = !!firstPage && !isPlaceholderData && total === 0
  const isNarrowed = listScope !== 'all'
  const { data: mergedData } = useOwnerDocuments(
    { ...scope, scope: 'all' },
    { enabled: isNarrowed && isEmpty }
  )
  const [hasShownCard, setHasShownCard] = useState(false)

  const listActions = useDocumentsListActions({ userId, docs: rows })
  const { pendingDelete, handleUndo } = listActions
  const { navigateToDocument, isLoading: isCreatingDocument } = useNavigateToDocument()

  const cardState = homeCardState({
    hasPage: !!firstPage,
    isError,
    isEmpty,
    isNarrowed,
    mergedTotal: isNarrowed ? mergedData?.pages[0]?.total : total,
    hasShownCard,
    hasPendingDelete: !!pendingDelete
  })
  if (cardState !== 'hidden' && !hasShownCard) setHasShownCard(true)
  if (cardState === 'hidden') return null

  const emptyText =
    cardState === 'empty' && listScope !== 'all' ? DOCUMENTS_EMPTY_TEXT[listScope] : null

  return (
    <section
      aria-labelledby="home-documents-heading"
      className="rounded-box bg-base-100 border-base-300 mt-4 border p-3 motion-safe:animate-[doc-content-in_180ms_ease-out_both] sm:mt-6 sm:p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <h2 id="home-documents-heading" className="text-base-content text-sm font-semibold">
          Documents
        </h2>
        {total > HOME_DOCUMENTS_LIMIT && (
          <Button variant="quiet" onClick={onSeeAll}>
            See all
          </Button>
        )}
      </div>

      {pendingDelete && (
        <DocumentUndoBanner title={pendingDelete.title} onUndo={handleUndo} className="mx-2 mb-2" />
      )}

      <div className="flex items-center gap-2 px-2 pb-2 sm:gap-3">
        <DocumentsListSelects />
      </div>

      {rows.length > 0 && (
        <DocumentsList
          docs={rows}
          viewMode="list"
          scope={scope}
          actions={listActions}
          // The keyboard collapses this card on a phone, so rename moves to a dialog.
          renameInDialog={isHomeMobileLayout}
          className={twMerge('motion-safe:transition-opacity', isPlaceholderData && 'opacity-60')}
        />
      )}
      {emptyText && (
        <EmptyState
          layout="inline"
          {...emptyText}
          className="px-2"
          action={
            listScope === 'owned' && (
              <Button
                variant="quiet"
                loading={isCreatingDocument}
                onClick={() => void navigateToDocument()}>
                Create document
              </Button>
            )
          }
        />
      )}
    </section>
  )
}
