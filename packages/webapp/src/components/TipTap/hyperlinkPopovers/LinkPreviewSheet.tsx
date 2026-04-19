import { Icons } from '@components/icons/registry'
import { copyToClipboard } from '@docs.plus/extension-hyperlink'
import { type SheetDataMap, useSheetStore } from '@stores'
import { useEffect } from 'react'

import { navigateHref } from './hrefEventHandler'
import { safeImageSrc, writeLinkMetadataAttrs } from './linkMarkUtils'
import { type LinkMetadata, useLinkMetadata } from './useLinkMetadata'

interface LinkPreviewSheetProps {
  data: SheetDataMap['linkPreview']
}

interface LinkPreviewAction {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
}

const ICON_SIZE = 20

const pickImageSrc = (data: LinkMetadata | null): string | undefined =>
  safeImageSrc(data?.icon) ||
  safeImageSrc(data?.publisher?.logo) ||
  safeImageSrc(data?.image?.url) ||
  safeImageSrc(data?.favicon) ||
  safeImageSrc(data?.oembed?.thumbnail)

/**
 * Mobile bottom-sheet preview for an existing hyperlink. Mounted by
 * `BottomSheet.tsx` whenever `useSheetStore.activeSheet === 'linkPreview'`,
 * which passes the sheet payload (`href`, `editor`, `nodePos`, `attrs`)
 * as props.
 *
 * Metadata is resolved through `useLinkMetadata` (L1 → L2 → L3 cache
 * chain) and written back onto the Tiptap mark as a side effect — the
 * sheet itself stays presentational.
 */
const LinkPreviewSheet = ({ data: payload }: LinkPreviewSheetProps) => {
  const closeSheet = useSheetStore((s) => s.closeSheet)
  const switchSheet = useSheetStore((s) => s.switchSheet)
  const { href, editor, nodePos, attrs } = payload

  const { status, data } = useLinkMetadata(href, {
    initialTitle: typeof attrs?.title === 'string' ? attrs.title : undefined,
    initialImage: typeof attrs?.image === 'string' ? attrs.image : undefined
  })

  // Persist fresh metadata to the Tiptap mark for next-session L1 reuse.
  // Safe to do while the sheet is open: the sheet is fixed at the
  // viewport bottom and isn't anchored to the link DOM, so the mark
  // re-render that ProseMirror triggers can't dismiss it (the failure
  // mode that bit the desktop floating popover). `writeLinkMetadataAttrs`
  // is itself a no-op when title + image are unchanged, so no extra
  // write-once guard is needed here.
  useEffect(() => {
    if (status !== 'loaded' || !data) return
    writeLinkMetadataAttrs(editor, nodePos, href, data)
  }, [status, data, editor, nodePos, href])

  const imageUrl = pickImageSrc(data)
  const title = data?.title || href
  const description = data?.description
  const showHrefLine = Boolean(data?.title && data.title !== href)

  const actions: LinkPreviewAction[] = [
    {
      key: 'open',
      label: 'Open link',
      icon: <Icons.externalLink size={ICON_SIZE} />,
      onClick: () => {
        // Reuse the desktop navigation logic so in-app deep links
        // (same-doc headings, chatrooms, history hash) behave
        // identically across platforms.
        navigateHref(href)
        closeSheet()
      }
    },
    {
      key: 'copy',
      label: 'Copy link',
      icon: <Icons.copy size={ICON_SIZE} />,
      onClick: () => {
        copyToClipboard(href, (ok) => {
          if (ok) closeSheet()
          else console.error('Failed to copy to clipboard')
        })
      }
    },
    {
      key: 'edit',
      label: 'Edit link',
      icon: <Icons.pencil size={ICON_SIZE} />,
      onClick: () => {
        // switchSheet runs the close→open transition through the store,
        // letting react-modal-sheet animate the swap rather than
        // remounting both at once.
        //
        // `onBack` lets the editor sheet route the user back to this
        // preview when they tap the header back arrow — re-using the
        // original payload so the link is shown in its pre-edit state.
        switchSheet('linkEditor', {
          mode: 'edit',
          initialHref: href,
          onSubmit: (next) => {
            editor.chain().focus().extendMarkRange('hyperlink').editHyperlinkHref(next).run()
          },
          onBack: () => switchSheet('linkPreview', { href, editor, nodePos, attrs })
        })
      }
    },
    {
      key: 'remove',
      label: 'Remove link',
      icon: <Icons.unlink size={ICON_SIZE} />,
      danger: true,
      onClick: () => {
        editor.chain().focus().unsetHyperlink().run()
        closeSheet()
      }
    }
  ]

  return (
    <div className="bg-base-100 flex flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="border-base-300 flex flex-col gap-1 border-b pb-3">
        <div className="flex items-start gap-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={data?.image?.alt || title}
              className="mt-0.5 size-5 shrink-0 rounded"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span className="bg-base-300 mt-0.5 size-5 shrink-0 rounded" aria-hidden />
          )}
          <span className="text-base-content min-w-0 flex-1 text-[0.95rem] leading-snug font-medium break-words">
            {title}
          </span>
        </div>
        {description && (
          <p className="text-base-content/75 m-0 text-sm leading-snug break-words">{description}</p>
        )}
        {showHrefLine && (
          <div className="text-base-content/60 truncate text-xs" title={href}>
            {href}
          </div>
        )}
      </header>
      <ul className="flex flex-col">
        {actions.map((action) => (
          <li key={action.key}>
            <button
              type="button"
              onClick={action.onClick}
              className={`hover:bg-base-200 active:bg-base-200 flex min-h-12 w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-base transition-colors ${
                action.danger ? 'text-error' : 'text-base-content'
              }`}>
              <span
                className={`inline-flex size-6 shrink-0 items-center justify-center ${
                  action.danger ? 'text-error' : 'text-base-content/70'
                }`}>
                {action.icon}
              </span>
              <span className="flex-1">{action.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default LinkPreviewSheet
