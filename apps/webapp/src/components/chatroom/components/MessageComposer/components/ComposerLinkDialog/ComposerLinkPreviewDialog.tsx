import { Icons } from '@components/icons/registry'
import { InternalLinkChip } from '@components/TipTap/hyperlinkPopovers/components/InternalLinkChip'
import { padNavigate } from '@components/TipTap/hyperlinkPopovers/hrefEventHandler'
import {
  describeDestination,
  linkDestination
} from '@components/TipTap/hyperlinkPopovers/internalDocumentLink'
import { runInternalDocumentLink } from '@components/TipTap/hyperlinkPopovers/internalDocumentLinkActions'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

import { ComposerLinkModalShell } from './ComposerLinkModalShell'

type Props = {
  href: string
  onEdit: () => void
  onRemove: () => void
  onClose: () => void
}

export function ComposerLinkPreviewDialog({ href, onEdit, onRemove, onClose }: Props) {
  const padEditor = useStore((s) => s.settings.editor.instance)
  const destination = useMemo(() => linkDestination(href), [href])
  const descriptor = describeDestination(destination, padEditor ?? null)

  const { copy, copied } = useCopyToClipboard({
    successMessage: null,
    errorMessage: 'Failed to copy link'
  })

  const handleGo = () => {
    if (destination.kind !== 'here') return
    onClose()
    runInternalDocumentLink(destination.link)
  }

  // C6: a plain open, so `navigateHref` routes another pad in place and opens an external
  // page or `/new` in a new tab (#359, PWA guard). Close first: the close pops history,
  // which would undo a route.
  const canOpen = destination.kind !== 'here' && destination.kind !== 'other'
  const handleOpen = () => {
    onClose()
    padNavigate(href, { newTab: false })
  }

  return (
    <ComposerLinkModalShell title="Link options" onClose={onClose}>
      <div data-testid="composer-link-preview" className="flex flex-col gap-4">
        {descriptor ? (
          <InternalLinkChip destination={destination} descriptor={descriptor} hideFilterSublabel />
        ) : (
          <p className="truncate text-sm" title={href}>
            {href}
          </p>
        )}
        <div className="-mx-2.5 flex flex-col">
          {canOpen && (
            <ContextMenuRowButton
              icon={<Icons.externalLink size={16} aria-hidden />}
              onClick={handleOpen}
              rowClassName="min-h-10"
              data-testid="composer-link-preview-open">
              Open link
            </ContextMenuRowButton>
          )}
          {destination.kind === 'here' && (
            <ContextMenuRowButton
              icon={<Icons.chevronRight size={16} aria-hidden />}
              onClick={handleGo}
              rowClassName="min-h-10"
              data-testid="composer-link-preview-go">
              Go to destination
            </ContextMenuRowButton>
          )}
          <ContextMenuRowButton
            icon={<Icons.copy size={16} aria-hidden />}
            rowClassName={twMerge('min-h-10', copied && 'text-[var(--success-ink)]')}
            onClick={() => void copy(href)}
            aria-label={copied ? 'Copied!' : 'Copy link'}
            data-testid="composer-link-preview-copy">
            <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
              <span className="swap-on">Copied!</span>
              <span className="swap-off">Copy link</span>
            </span>
          </ContextMenuRowButton>
          <ContextMenuRowButton
            icon={<Icons.edit size={16} aria-hidden />}
            onClick={onEdit}
            rowClassName="min-h-10"
            data-testid="composer-link-preview-edit">
            Edit link
          </ContextMenuRowButton>
          <ContextMenuDivider as="div" />
          <ContextMenuRowButton
            icon={<Icons.unlink size={16} aria-hidden />}
            variant="danger"
            onClick={onRemove}
            rowClassName="min-h-10"
            data-testid="composer-link-preview-remove">
            Remove link
          </ContextMenuRowButton>
        </div>
      </div>
    </ComposerLinkModalShell>
  )
}
