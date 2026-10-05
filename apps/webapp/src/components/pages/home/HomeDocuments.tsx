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
import { useMemo, useState } from 'react'

import { isHomeMobileLayout } from './homeMobileLayout'

const HOME_DOCUMENTS_LIMIT = 8

interface HomeDocumentsProps {
  userId: string
  onSeeAll: () => void
}

/**
 * A short door into the Merged list, with the Settings rows, picks and Undo. It hides on the
 * first load, on error and when the Merged list is empty, so the slug card never waits on it.
 * A Show pick with no rows keeps the card, so the pick stays reachable.
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
  const mergedTotal = isNarrowed ? mergedData?.pages[0]?.total : total
  // A card on screen stays while that probe loads, so it never blinks out under the finger.
  const [hasShownCard, setHasShownCard] = useState(false)
  const isMergedEmpty =
    isEmpty && (mergedTotal === 0 || (mergedTotal === undefined && !hasShownCard))

  const listActions = useDocumentsListActions({ userId, docs: rows })
  const { pendingDelete, handleUndo } = listActions
  const { navigateToDocument, isLoading: isCreatingDocument } = useNavigateToDocument()

  // A pending Undo keeps the card, so Undo stays reachable after the last row goes.
  const isShown = (!isError && !!firstPage && !isMergedEmpty) || !!pendingDelete
  if (isShown && !hasShownCard) setHasShownCard(true)
  if (!isShown) return null

  const emptyText = isEmpty && listScope !== 'all' ? DOCUMENTS_EMPTY_TEXT[listScope] : null

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
          className={isPlaceholderData ? 'transition-opacity motion-safe:opacity-60' : undefined}
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
