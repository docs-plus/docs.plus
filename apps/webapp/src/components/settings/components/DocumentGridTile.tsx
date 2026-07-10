import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { LuEye, LuFileText, LuLock } from 'react-icons/lu'

import { type DocumentMembersEntry } from '../hooks/useDocumentMembers'
import type { DocumentSortKey, OwnedDocument } from '../types'
import { formatShortDate } from '../utils/formatShortDate'
import DocumentMembersCluster from './DocumentMembersCluster'
import DocumentRowMenu from './DocumentRowMenu'
import RenameDocumentDialog from './RenameDocumentDialog'

interface DocumentGridTileProps {
  doc: OwnedDocument
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
  members?: DocumentMembersEntry
  onOpenDocument?: () => void
  onDelete: (documentId: string, keyboard: boolean) => void
}

/**
 * One tile in the grid view — icon-led preview band (no thumbnail). Preview + title
 * navigate; the footer ⋮ menu is a sibling so it never nests inside the nav button.
 */
function DocumentGridTile({
  doc,
  userId,
  searchQuery,
  sortKey,
  members,
  onOpenDocument,
  onDelete
}: DocumentGridTileProps) {
  const router = useRouter()
  const openDialog = useStore((state) => state.openDialog)
  const label = doc.title ?? doc.slug
  const date = formatShortDate(doc.updatedAt)

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
        onClick={open}
        className="flex flex-col text-left focus-visible:outline-none">
        <span className="bg-base-200 rounded-t-box relative flex aspect-[4/3] items-center justify-center">
          <LuFileText size={32} className="text-base-content/40" />
          {(doc.isPrivate || doc.readOnly) && (
            <span className="text-base-content/50 absolute top-2 right-2 flex items-center gap-1">
              {doc.isPrivate && <LuLock size={14} aria-label="Private" />}
              {doc.readOnly && <LuEye size={14} aria-label="Read-only" />}
            </span>
          )}
        </span>
        <span className="text-base-content line-clamp-2 px-3 pt-3 text-sm font-medium">
          {label}
        </span>
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 px-3 pt-1 pb-2">
        <span className="flex min-w-0 items-center gap-2">
          <DocumentMembersCluster
            slug={doc.slug}
            memberCount={members?.member_count ?? 0}
            previews={members?.previews ?? []}
            size="xs"
          />
          <span className="text-base-content/50 truncate text-xs">{date}</span>
        </span>
        <DocumentRowMenu
          documentId={doc.documentId}
          slug={doc.slug}
          title={doc.title}
          isPrivate={doc.isPrivate}
          readOnly={doc.readOnly}
          userId={userId}
          searchQuery={searchQuery}
          sortKey={sortKey}
          onRename={openRenameDialog}
          onDelete={(keyboard) => onDelete(doc.documentId, keyboard)}
          onOpenDocument={onOpenDocument}
        />
      </div>
    </div>
  )
}

export default DocumentGridTile
