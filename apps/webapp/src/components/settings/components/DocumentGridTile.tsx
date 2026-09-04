import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { LuEye, LuLock, LuStar } from 'react-icons/lu'

import { type DocumentMembersEntry } from '../hooks/useDocumentMembers'
import type { DocumentSortKey, OwnedDocument } from '../types'
import { documentListDate } from '../utils/documentListDate'
import DocumentMembersCluster from './DocumentMembersCluster'
import DocumentPreviewPaper from './DocumentPreviewPaper'
import DocumentRowMenu from './DocumentRowMenu'
import RenameDocumentDialog from './RenameDocumentDialog'

interface DocumentGridTileProps {
  doc: OwnedDocument
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
  members?: DocumentMembersEntry
  onOpenDocument?: () => void
  index: number
  isActive: boolean
  onActivate: (index: number) => void
  onDelete: (documentId: string, keyboard: boolean) => void
}

/** Preview + title navigate; the footer ⋮ is a sibling so it never nests in the nav button. */
function DocumentGridTile({
  doc,
  userId,
  searchQuery,
  sortKey,
  members,
  onOpenDocument,
  index,
  isActive,
  onActivate,
  onDelete
}: DocumentGridTileProps) {
  const router = useRouter()
  const openDialog = useStore((state) => state.openDialog)
  const label = doc.title ?? doc.slug
  const date = documentListDate(doc, sortKey)

  const open = () => {
    router.push(`/${doc.slug}`)
    onOpenDocument?.()
  }

  const openRenameDialog = () => {
    openDialog(
      <RenameDocumentDialog
        documentId={doc.documentId}
        currentTitle={doc.title}
        userId={userId}
        searchQuery={searchQuery}
        sortKey={sortKey}
      />,
      { size: 'sm', align: 'top', className: 'mt-14' }
    )
  }

  return (
    <div className="rounded-box border-base-300 bg-base-100 hover:bg-base-200 focus-within:ring-primary flex flex-col border transition-colors focus-within:ring-2">
      <button
        type="button"
        data-doc-row-button
        tabIndex={isActive ? 0 : -1}
        onClick={open}
        onFocus={() => onActivate(index)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault()
            openRenameDialog()
          }
        }}
        className="flex flex-col text-left focus-visible:outline-none">
        <span className="rounded-t-box relative flex aspect-[4/3] items-end justify-center bg-[var(--pad-well)] px-3.5 pt-2.5">
          <DocumentPreviewPaper preview={doc.preview} title={doc.title} variant="tile" />
          {doc.isFavorite && (
            <span className="absolute top-2 left-2 z-10">
              <LuStar size={14} className="text-accent fill-accent" aria-label="Favorite" />
            </span>
          )}
          {(doc.isPrivate || doc.readOnly) && (
            <span className="text-base-content/60 absolute top-2 right-2 z-10 flex items-center gap-1">
              {doc.isPrivate && <LuLock size={14} aria-label="Private" />}
              {doc.readOnly && <LuEye size={14} aria-label="Read-only" />}
            </span>
          )}
        </span>
        <span className="text-base-content line-clamp-2 px-3 pt-3 text-sm font-medium">
          {label}
        </span>
        <span className="text-base-content/60 px-3 pt-0.5 text-xs">{date}</span>
      </button>

      <div className="mt-auto flex items-center gap-2 px-3 pt-1 pb-2">
        <DocumentMembersCluster
          workspaceId={doc.documentId.toLowerCase()}
          memberCount={members?.member_count ?? 0}
          previews={members?.previews ?? []}
          size="xs"
          tabIndex={-1}
        />
        <div className="ml-auto">
          <DocumentRowMenu
            documentId={doc.documentId}
            slug={doc.slug}
            title={doc.title}
            isPrivate={doc.isPrivate}
            readOnly={doc.readOnly}
            isFavorite={doc.isFavorite}
            userId={userId}
            searchQuery={searchQuery}
            sortKey={sortKey}
            triggerTabIndex={isActive ? 0 : -1}
            onRename={openRenameDialog}
            onDelete={(keyboard) => onDelete(doc.documentId, keyboard)}
            onOpenDocument={onOpenDocument}
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentGridTile
