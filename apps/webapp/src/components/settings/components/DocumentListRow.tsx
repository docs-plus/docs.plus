import TextInput from '@components/ui/TextInput'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { LuEye, LuFileText, LuLock } from 'react-icons/lu'

import useCommitDocumentRename from '../hooks/useCommitDocumentRename'
import { type DocumentMembersEntry } from '../hooks/useDocumentMembers'
import type { DocumentSortKey, OwnedDocument } from '../types'
import { formatShortDate } from '../utils/formatShortDate'
import DocumentMembersCluster from './DocumentMembersCluster'
import DocumentRowMenu from './DocumentRowMenu'

interface DocumentListRowProps {
  doc: OwnedDocument
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
  members?: DocumentMembersEntry
  onOpenDocument?: () => void
  /** Roving-tabindex plumbing owned by DocumentsSection. */
  index: number
  isActive: boolean
  onActivate: (index: number) => void
  onDelete: (documentId: string, keyboard: boolean) => void
}

/**
 * One row in the list view. Row body navigates; the ⋮ menu is a sibling (its own
 * trigger stops propagation), so it never fires row nav and never nests button-in-button.
 * F2 (or the menu's Rename) swaps the title for an inline input; Enter/blur commit,
 * Esc reverts. Empty/whitespace after trim reverts with no request.
 */
function DocumentListRow({
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
}: DocumentListRowProps) {
  const router = useRouter()
  const label = doc.title ?? doc.slug
  const date = formatShortDate(doc.updatedAt)

  const { commit } = useCommitDocumentRename(userId, searchQuery, sortKey)
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter commits then blurs the unmounting input, which would commit again — latch once.
  const finishedRef = useRef(false)
  const wasRenamingRef = useRef(false)

  const enterRename = () => {
    setDraft(doc.title ?? '')
    finishedRef.current = false
    setIsRenaming(true)
  }

  // Focus + select after the popover has returned focus to its (now-unmounted) trigger.
  useEffect(() => {
    if (!isRenaming) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => clearTimeout(timer)
  }, [isRenaming])

  // Return focus to the row button once the input is gone.
  useEffect(() => {
    if (isRenaming) {
      wasRenamingRef.current = true
      return
    }
    if (wasRenamingRef.current) {
      wasRenamingRef.current = false
      // Defer to the next frame so the committing Enter keystroke fully settles before
      // focus lands on the button — otherwise that same Enter activates it (navigates).
      requestAnimationFrame(() => buttonRef.current?.focus())
    }
  }, [isRenaming])

  const open = () => {
    router.push(`/${doc.slug}`)
    onOpenDocument?.()
  }

  const commitAndExit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    void commit(doc.documentId, doc.title, draft)
    setIsRenaming(false)
  }

  const cancelAndExit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <li className="flex items-center gap-3 px-2 py-2">
        <LuFileText size={18} className="text-base-content/40 shrink-0" />
        <TextInput
          ref={inputRef}
          size="sm"
          wrapperClassName="min-w-0 flex-1"
          value={draft}
          maxLength={255}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Stop the key here: without it the committing Enter bubbles/defaults into the
            // row button (focused on exit) and navigates into the doc, leaving the modal.
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              commitAndExit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              cancelAndExit()
            }
          }}
          onBlur={commitAndExit}
          aria-label={`Rename “${label}”`}
        />
      </li>
    )
  }

  return (
    <li className="hover:bg-base-200 flex items-center gap-1 pr-1 transition-colors">
      <button
        ref={buttonRef}
        type="button"
        data-doc-row-button
        tabIndex={isActive ? 0 : -1}
        onClick={open}
        onFocus={() => onActivate(index)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault()
            enterRename()
          }
        }}
        className="rounded-field focus-visible:ring-primary flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
        <LuFileText size={18} className="text-base-content/40 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-base-content truncate font-medium">{label}</span>
            {doc.isPrivate && (
              <LuLock size={13} className="text-base-content/50 shrink-0" aria-label="Private" />
            )}
            {doc.readOnly && (
              <LuEye size={13} className="text-base-content/50 shrink-0" aria-label="Read-only" />
            )}
          </span>
          <span className="text-base-content/50 text-xs sm:hidden">{date}</span>
        </span>
      </button>

      <DocumentMembersCluster
        slug={doc.slug}
        memberCount={members?.member_count ?? 0}
        previews={members?.previews ?? []}
        tabIndex={-1}
      />
      <span className="text-base-content/50 hidden shrink-0 text-xs sm:block">{date}</span>

      <DocumentRowMenu
        documentId={doc.documentId}
        slug={doc.slug}
        title={doc.title}
        isPrivate={doc.isPrivate}
        readOnly={doc.readOnly}
        userId={userId}
        searchQuery={searchQuery}
        sortKey={sortKey}
        triggerTabIndex={isActive ? 0 : -1}
        onRename={enterRename}
        onDelete={(keyboard) => onDelete(doc.documentId, keyboard)}
        onOpenDocument={onOpenDocument}
      />
    </li>
  )
}

export default DocumentListRow
