import { padUrl } from '@services/padUrl'
import { useRouter } from 'next/router'
import { LuEye, LuLock, LuStar } from 'react-icons/lu'

import type { DocumentsListScope } from '../documentsQueryKey'
import { type DocumentMembersEntry } from '../hooks/useDocumentMembers'
import { openRenameDocumentDialog } from '../openRenameDocumentDialog'
import type { OwnedDocument } from '../types'
import { documentDisplayName } from '../utils/documentDisplayName'
import { documentListDate } from '../utils/documentListDate'
import { isPlainLeftClick } from '../utils/isPlainLeftClick'
import DocumentMembersCluster from './DocumentMembersCluster'
import DocumentPreviewPaper from './DocumentPreviewPaper'
import DocumentRowMenu from './DocumentRowMenu'

interface DocumentGridTileProps {
  doc: OwnedDocument
  scope: DocumentsListScope
  members?: DocumentMembersEntry
  onOpenDocument?: () => void
  index: number
  isActive: boolean
  onActivate: (index: number) => void
  onDelete: (documentId: string, keyboard: boolean) => void
}

/** The whole tile is one link (middle-click opens a new tab); the footer buttons are siblings. */
function DocumentGridTile({
  doc,
  scope,
  members,
  onOpenDocument,
  index,
  isActive,
  onActivate,
  onDelete
}: DocumentGridTileProps) {
  const router = useRouter()
  const label = documentDisplayName(doc)
  const date = documentListDate(doc, scope.sortKey)
  // An old server omits isOwner, and it answers the owned list only.
  const isOwner = doc.isOwner !== false
  const ownerName = isOwner ? null : doc.owner?.display_name

  const href = padUrl.link({ kind: 'document', slug: doc.slug }, 'path')
  const open = (e: React.MouseEvent) => {
    if (!isPlainLeftClick(e)) return
    e.preventDefault()
    router.push(href)
    onOpenDocument?.()
  }

  const openRenameDialog = () => openRenameDocumentDialog(doc, scope)

  return (
    <div className="rounded-box border-base-300 bg-base-100 hover:bg-base-200 focus-within:ring-primary relative flex flex-col border transition-colors focus-within:ring-2">
      <a
        href={href}
        data-doc-row-button
        tabIndex={isActive ? 0 : -1}
        onClick={open}
        onFocus={() => onActivate(index)}
        onKeyDown={(e) => {
          if (e.key === 'F2' && isOwner) {
            e.preventDefault()
            openRenameDialog()
          }
        }}
        className="flex flex-col text-left after:absolute after:inset-0 focus-visible:outline-none">
        <span className="rounded-t-box relative flex aspect-[4/3] items-end justify-center overflow-hidden bg-[var(--pad-well)] px-3.5 pt-2.5">
          <DocumentPreviewPaper preview={doc.preview} title={doc.title} />
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
        <span className="text-meta text-base-content/60 truncate px-3 pt-0.5">
          {ownerName ? (
            <>
              <bdi>{ownerName}</bdi> · {date}
            </>
          ) : (
            date
          )}
        </span>
      </a>

      {/* The link's `after:` box covers the whole tile; footer buttons sit above it. */}
      <div className="mt-auto flex items-center gap-2 px-3 pt-1 pb-2 [&_button]:relative">
        <DocumentMembersCluster
          documentId={doc.documentId}
          memberCount={members?.member_count ?? 0}
          previews={members?.previews ?? []}
          size="xs"
          tabIndex={-1}
        />
        <div className="ml-auto">
          <DocumentRowMenu
            doc={doc}
            scope={scope}
            isOwner={isOwner}
            triggerTabIndex={isActive ? 0 : -1}
            onRename={openRenameDialog}
            onDelete={(keyboard) => onDelete(doc.documentId, keyboard)}
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentGridTile
