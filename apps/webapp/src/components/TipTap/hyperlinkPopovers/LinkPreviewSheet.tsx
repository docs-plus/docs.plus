import { SheetLayout } from '@components/SheetLayout'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { useCloseAfterHold } from '@hooks/useCloseAfterHold'
import { Icons } from '@icons'
import { type SheetDataMap, useSheetStore } from '@stores'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'
import { twMerge } from '@utils/twMerge'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { InternalLinkChip } from './components/InternalLinkChip'
import { classifyInternalDocumentLink } from './internalDocumentLink'
import { safeImageSrc, writeLinkMetadataAttrs } from './linkMarkUtils'
import { buildLinkPreviewActions } from './linkPreviewActions'
import { type LinkMetadata, useLinkMetadata } from './useLinkMetadata'

interface LinkPreviewSheetProps {
  data: SheetDataMap['linkPreview']
}

const pickImageSrc = (data: LinkMetadata | null): string | undefined =>
  safeImageSrc(data?.icon) ||
  safeImageSrc(data?.publisher?.logo) ||
  safeImageSrc(data?.image?.url) ||
  safeImageSrc(data?.favicon) ||
  safeImageSrc(data?.oembed?.thumbnail)

/**
 * External-link header: unfurled favicon/title/description. Isolated in its
 * own component so the metadata fetch hook never runs for internal links.
 */
const ExternalLinkHeader = ({ data: payload }: LinkPreviewSheetProps) => {
  const { href, editor, nodePos, attrs } = payload
  const { status, data } = useLinkMetadata(href, {
    initialTitle: typeof attrs?.title === 'string' ? attrs.title : undefined,
    initialImage: typeof attrs?.image === 'string' ? attrs.image : undefined
  })

  // Safe while the sheet is open: mobile sheet is viewport-fixed, not anchored to link DOM.
  useEffect(() => {
    if (status !== 'loaded' || !data) return
    writeLinkMetadataAttrs(editor, nodePos, href, data)
  }, [status, data, editor, nodePos, href])

  const imageUrl = pickImageSrc(data)
  const title = data?.title || href
  const description = data?.description
  const showHrefLine = Boolean(data?.title && data.title !== href)

  if (status === 'loading') {
    return (
      <div className="flex items-start gap-3">
        <span className="sr-only">Loading link details</span>
        <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center">
          <span className="skeleton size-5" />
        </span>
        {/* 22px: the title's text-base leading-snug line. */}
        <div aria-hidden className="flex h-5.5 min-w-0 flex-1 items-center">
          <div className="skeleton h-4 w-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex size-6 shrink-0 items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={data?.image?.alt || title}
            className="size-5 rounded"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="bg-base-300 size-5 rounded" aria-hidden />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base-content m-0 text-base leading-snug font-medium break-words">
          {title}
        </p>
        {description && (
          <p className="text-base-content/70 m-0 text-sm leading-snug break-words">{description}</p>
        )}
        {showHrefLine && (
          <p
            className="text-base-content/60 m-0 line-clamp-2 text-sm leading-snug break-all"
            title={href}>
            {href}
          </p>
        )}
      </div>
    </div>
  )
}

const LinkPreviewSheet = ({ data: payload }: LinkPreviewSheetProps) => {
  const closeSheet = useSheetStore((s) => s.closeSheet)
  const switchSheet = useSheetStore((s) => s.switchSheet)
  const { href, editor } = payload
  const [copied, setCopied] = useState(false)
  const { schedule, cancel } = useCloseAfterHold(closeSheet)

  const onCopySuccess = () => {
    setCopied(true)
    schedule()
  }

  const internalLink = useMemo(
    () => classifyInternalDocumentLink(href, window.location.pathname),
    [href]
  )

  const actions = buildLinkPreviewActions({ payload, closeSheet, switchSheet, onCopySuccess })

  return (
    <SheetLayout title="Link" onClose={closeSheet}>
      <div className={`pt-3 ${sheetBodyPadClassName}`}>
        <div className="border-base-300 border-b pb-3">
          {internalLink ? (
            <InternalLinkChip link={internalLink} editor={editor} />
          ) : (
            <ExternalLinkHeader data={payload} />
          )}
        </div>
      </div>
      <ul className="flex flex-col px-2 pt-1">
        {actions.map((action) => {
          const isCopy = action.key === 'copy'
          return (
            <Fragment key={action.key}>
              {action.danger && <ContextMenuDivider />}
              <li>
                <ContextMenuRowButton
                  onClick={() => {
                    if (!isCopy) cancel()
                    action.onClick()
                  }}
                  aria-label={isCopy ? (copied ? 'Copied!' : action.label) : undefined}
                  data-testid={`hyperlink-preview-${action.key}`}
                  variant={action.danger ? 'danger' : 'default'}
                  rowClassName={twMerge(
                    'min-h-12',
                    isCopy && copied && 'text-[var(--success-ink)]'
                  )}
                  icon={
                    isCopy ? (
                      <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
                        <Icons.check size={16} className="swap-on text-success" />
                        <span className="swap-off inline-flex">{action.icon}</span>
                      </span>
                    ) : (
                      action.icon
                    )
                  }>
                  {isCopy ? (
                    <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
                      <span className="swap-on">Copied!</span>
                      <span className="swap-off">{action.label}</span>
                    </span>
                  ) : (
                    action.label
                  )}
                </ContextMenuRowButton>
              </li>
            </Fragment>
          )
        })}
      </ul>
    </SheetLayout>
  )
}

export default LinkPreviewSheet
