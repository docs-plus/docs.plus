import { ListGroupLabel } from '@components/ui/ListGroupLabel'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

import type { DocumentViewMode } from '../constants'
import type { DocumentsListScope } from '../documentsQueryKey'
import { documentMembersKey, useDocumentMembers } from '../hooks/useDocumentMembers'
import type { DocumentsListActions } from '../hooks/useDocumentsListActions'
import type { OwnedDocument } from '../types'
import { buildDocumentsListItems, type DocumentsListItem } from '../utils/documentsListItems'
import DocumentGridTile from './DocumentGridTile'
import DocumentListRow from './DocumentListRow'

interface DocumentsListProps {
  docs: OwnedDocument[]
  viewMode: DocumentViewMode
  scope: DocumentsListScope
  actions: DocumentsListActions
  onOpenDocument?: () => void
  /** List rows only: true opens the rename dialog instead of the inline input. */
  renameInDialog?: () => boolean
  className?: string
}

/**
 * The rows of a documents list, for Settings and the Home card. The list and the grid carry
 * the same item kinds and differ only in wrapper element and classes, so a new kind lands
 * here once.
 */
function DocumentsList({
  docs,
  viewMode,
  scope,
  actions,
  onOpenDocument,
  renameInDialog,
  className
}: DocumentsListProps) {
  const items = useMemo(() => buildDocumentsListItems(docs, scope.sortKey), [docs, scope.sortKey])
  const { data: membersMap } = useDocumentMembers(docs.map(documentMembersKey), !!scope.userId)
  const { bindListRef, activeIndex, setActiveIndex, handleListKeyDown, handleDelete } = actions

  const isListView = viewMode === 'list'
  const ItemWrapper = isListView ? 'li' : 'div'

  const renderItem = (item: DocumentsListItem) => {
    if (item.kind === 'hairline') {
      return (
        <ItemWrapper
          key="favorites-end"
          aria-hidden
          className={
            isListView
              ? 'pointer-events-none my-3'
              : 'border-base-300 col-span-2 my-1 border-t lg:col-span-3'
          }>
          {isListView ? <div className="border-base-300 border-t" /> : null}
        </ItemWrapper>
      )
    }
    if (item.kind === 'bucket') {
      return (
        <ListGroupLabel
          as={ItemWrapper}
          key={item.key}
          className={isListView ? 'px-2 pt-4 pb-1' : 'col-span-2 pt-2 lg:col-span-3'}>
          {item.label}
        </ListGroupLabel>
      )
    }
    const shared = {
      doc: item.doc,
      scope,
      members: membersMap?.get(documentMembersKey(item.doc)),
      onOpenDocument,
      index: item.index,
      isActive: item.index === activeIndex,
      onActivate: setActiveIndex,
      onDelete: handleDelete
    }
    return isListView ? (
      <DocumentListRow key={item.doc.documentId} {...shared} renameInDialog={renameInDialog} />
    ) : (
      <DocumentGridTile key={item.doc.documentId} {...shared} />
    )
  }

  return isListView ? (
    <ul
      ref={bindListRef}
      role="list"
      onKeyDown={handleListKeyDown}
      className={twMerge(
        '[&>li[data-doc-row]+li[data-doc-row]]:border-base-300 [&>li[data-doc-row]+li[data-doc-row]]:border-t',
        className
      )}>
      {items.map(renderItem)}
    </ul>
  ) : (
    <div
      ref={bindListRef}
      onKeyDown={handleListKeyDown}
      className={twMerge('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3', className)}>
      {items.map(renderItem)}
    </div>
  )
}

export default DocumentsList
