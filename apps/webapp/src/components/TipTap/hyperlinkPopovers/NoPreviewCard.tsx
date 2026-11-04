import Button, { quietActionClassName } from '@components/ui/Button'
import { type MouseEvent, type ReactNode, useState } from 'react'

import { fetchArchivedCopy } from './fetchMetadata'
import { LinkIcon } from './HovercardLinkLine'
import { Band, HovercardTitle, Note } from './HovercardParts'
import type { ArchivedCopy, LinkMiss } from './types'

type Props = {
  href: string
  title: string
  /** The full path, wrapped. The link line says why there is no preview in place of the address. */
  path: string
  /** Why the server got no preview; `unreachable` and `blocked` offer the archived copy. */
  miss?: LinkMiss
  /** `newTab` is true for Mod-click and a middle click. */
  onOpen: (newTab: boolean) => void
  /** The link-text warning, when there is one. */
  children?: ReactNode
}

/** The card body for a web link with no preview, or a file: the destination is the card. */
export function NoPreviewCard({ href, title, path, miss, onOpen, children }: Props) {
  return (
    <Band>
      <div className="flex min-w-0 items-center gap-2">
        <LinkIcon href={href} pad={false} className="size-5" />
        <HovercardTitle href={href} onOpen={onOpen}>
          {title}
        </HovercardTitle>
      </div>
      {path && <p className="text-meta text-base-content/70 [overflow-wrap:anywhere]">{path}</p>}
      {children}
      {(miss === 'unreachable' || miss === 'blocked') && <ArchivedCopyAction href={href} />}
    </Band>
  )
}

// Keeps the caret in the editor, as Use page title does.
const keepEditorFocus = (event: MouseEvent) => event.preventDefault()

/**
 * Asks the archive on click only. A hit becomes a plain link: a tab opened after the request
 * would meet the popup blocker. `fetchArchivedCopy` passes only `https://web.archive.org/web/`.
 */
function ArchivedCopyAction({ href }: { href: string }) {
  const [copy, setCopy] = useState<ArchivedCopy | 'idle' | 'busy'>('idle')

  const find = async () => {
    setCopy('busy')
    const found = await fetchArchivedCopy(href)
    setCopy(found)
  }

  if (copy === 'none') return <Note>No archived copy of this page.</Note>
  if (typeof copy === 'object') {
    return (
      <a
        href={copy.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        onMouseDown={keepEditorFocus}
        className={`${quietActionClassName} self-start`}>
        Open archived copy
      </a>
    )
  }
  return (
    <>
      {copy === 'unreachable' && <Note>The archive did not answer. Try again soon.</Note>}
      <Button
        variant="quiet"
        tabIndex={-1}
        loading={copy === 'busy'}
        onMouseDown={keepEditorFocus}
        onClick={find}
        className="self-start">
        View archived copy
      </Button>
    </>
  )
}
