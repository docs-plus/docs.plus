import { SheetLayout } from '@components/SheetLayout'
import { type SheetDataMap, useSheetStore } from '@stores'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

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

  const internalLink = useMemo(
    () => classifyInternalDocumentLink(href, window.location.pathname),
    [href]
  )

  const actions = buildLinkPreviewActions({ payload, closeSheet, switchSheet })

  return (
    <SheetLayout title="Link" onClose={closeSheet}>
      <div
        className={`flex flex-col py-3 pb-[max(1rem,env(safe-area-inset-bottom))] ${sheetBodyPadClassName}`}>
        <div className="border-base-300 border-b pb-3">
          {internalLink ? (
            <InternalLinkChip link={internalLink} editor={editor} />
          ) : (
            <ExternalLinkHeader data={payload} />
          )}
        </div>
        <ul className="flex flex-col pt-1">
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                onClick={action.onClick}
                data-testid={`hyperlink-preview-${action.key}`}
                className={twMerge(
                  'group hover:bg-base-200 active:bg-base-200 text-base-content flex min-h-12 w-full items-center gap-3 rounded-lg py-2.5 text-left text-base transition-colors',
                  action.danger && 'hover:text-error active:text-error'
                )}>
                <span
                  className={twMerge(
                    'text-base-content/70 inline-flex size-6 shrink-0 items-center justify-center',
                    action.danger && 'group-hover:text-error group-active:text-error'
                  )}>
                  {action.icon}
                </span>
                <span className="flex-1">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </SheetLayout>
  )
}

export default LinkPreviewSheet
