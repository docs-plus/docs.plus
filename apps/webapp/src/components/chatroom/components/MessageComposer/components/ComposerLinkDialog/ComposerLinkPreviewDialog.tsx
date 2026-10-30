import { Icons } from '@components/icons/registry'
import { InternalLinkChip } from '@components/TipTap/hyperlinkPopovers/components/InternalLinkChip'
import { isAnotherPad, padNavigate } from '@components/TipTap/hyperlinkPopovers/hrefEventHandler'
import { classifyInternalDocumentLink } from '@components/TipTap/hyperlinkPopovers/internalDocumentLink'
import { runInternalDocumentLink } from '@components/TipTap/hyperlinkPopovers/internalDocumentLinkActions'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useStore } from '@stores'
import { isWebHref } from '@utils/link-helpers'
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
  const internalLink = useMemo(
    () => classifyInternalDocumentLink(href, window.location.pathname),
    [href]
  )

  const { copy, copied } = useCopyToClipboard({
    successMessage: null,
    errorMessage: 'Failed to copy link'
  })

  const handleGo = () => {
    if (!internalLink) return
    onClose()
    runInternalDocumentLink(internalLink)
  }

  // C6: an external page opens in a new tab; another pad routes in place (#359, PWA guard).
  // Close first: the dialog close pops history, which would undo a later route.
  const canOpen = !internalLink && isWebHref(href)
  const handleOpen = () => {
    onClose()
    padNavigate(href, { newTab: !isAnotherPad(href) })
  }

  return (
    <ComposerLinkModalShell title="Link options" onClose={onClose}>
      <div data-testid="composer-link-preview" className="flex flex-col gap-4">
        {internalLink ? (
          <InternalLinkChip link={internalLink} editor={padEditor ?? null} hideFilterSublabel />
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
          {internalLink && (
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
