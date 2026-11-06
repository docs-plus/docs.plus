import { MEDIA_INSERT_REGISTRY } from '@components/TipTap/mediaPopovers/mediaInsert'
import { popoverPanelClassName } from '@components/ui/Popover'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useOverlayTransition } from '@components/ui/useOverlayTransition'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  limitShift,
  offset,
  shift,
  useFloating,
  useMergeRefs
} from '@floating-ui/react'
import { useHeadingUnreadCount } from '@hooks/useUnreadCount'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

import { TOC_CLASSES } from '../tocClasses'
import {
  buildSectionPreview,
  type PreviewMedia,
  type SectionPreview
} from '../utils/sectionPreviewClone'
import type { RailPreviewApi } from './useRailPreview'

const TITLE_CLASS =
  'tiptap ProseMirror text-base-content min-w-0 flex-1 text-sm leading-snug font-semibold [overflow-wrap:anywhere] line-clamp-2 [&_a]:text-primary [&_:is(h1,h2,h3,h4,h5,h6)]:!m-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!pr-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!text-sm [&_:is(h1,h2,h3,h4,h5,h6)]:!font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:!leading-snug [&_:is(h1,h2,h3,h4,h5,h6)]:!text-base-content'

const BODY_CLASS =
  'tiptap ProseMirror text-base-content/70 min-h-0 text-xs leading-relaxed [overflow-wrap:anywhere] line-clamp-3 [&_a]:text-primary [&_hr]:hidden [&_ol]:my-0.5 [&_p]:!my-0 [&_pre]:p-1.5 [&_pre]:text-[10px] [&_ul]:my-0.5 [&_:is(h1,h2,h3,h4,h5,h6)]:!m-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!pr-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!text-sm [&_:is(h1,h2,h3,h4,h5,h6)]:!font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:!leading-snug'

/** Shows cloned DOM. `inert` keeps cloned links and controls out of reach; the card names the heading. */
function CloneHost({
  node,
  fallback,
  className
}: {
  node: HTMLElement | null
  fallback?: string
  className: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    if (node) host.replaceChildren(node)
    else host.textContent = fallback ?? ''
    return () => host.replaceChildren()
  }, [fallback, node])
  return <div ref={ref} inert aria-hidden className={className} />
}

function MediaWell({ media }: { media: PreviewMedia }) {
  if (media.kind === 'image') {
    return <CloneHost node={media.el} className="bg-base-200 h-24 w-full overflow-hidden" />
  }
  const Icon =
    MEDIA_INSERT_REGISTRY[media.type ?? 'video']?.Icon ?? MEDIA_INSERT_REGISTRY.video.Icon
  return (
    <div
      aria-hidden
      data-toc-preview-tile={media.type ?? ''}
      className="bg-base-200 text-base-content/50 flex h-24 w-full items-center justify-center">
      <Icon size={24} />
    </div>
  )
}

function PreviewChatAction({
  headingId,
  label,
  actionRef,
  onClick
}: {
  headingId: string
  label: string
  actionRef: RefObject<HTMLButtonElement | null>
  onClick: RailPreviewApi['openChat']
}) {
  const unreadCount = useHeadingUnreadCount(headingId)
  // Never the ancestor-mapped chat tick: only this exact heading's open room counts.
  const isActive = useChatStore(
    (s) => s.chatRoom.headingId === headingId && s.chatRoom.paneMode !== 'closed'
  )

  return (
    <button
      ref={actionRef}
      type="button"
      data-toc-rail-preview-chat=""
      aria-label={isActive ? 'Close chatroom' : `Open chatroom for ${label}`}
      className="btn btn-ghost btn-sm btn-square -mt-1.5 -mr-1.5 shrink-0"
      onClick={onClick}>
      {unreadCount > 0 ? (
        <UnreadBadge count={unreadCount} size="sm" variant="error" />
      ) : (
        <Icons.chatroom
          size={20}
          aria-hidden
          className={twMerge(isActive && TOC_CLASSES.chatIconActive)}
        />
      )}
    </button>
  )
}

export function TocSectionPreview({
  headingId,
  label,
  referenceEl,
  api,
  cardRef,
  actionRef
}: {
  headingId: string | null
  label: string
  referenceEl: HTMLElement | null
  api: RailPreviewApi
  cardRef: RefObject<HTMLElement | null>
  actionRef: RefObject<HTMLButtonElement | null>
}) {
  const open = headingId != null && referenceEl != null
  const { refs, floatingStyles, context } = useFloating({
    placement: 'right',
    strategy: 'fixed',
    transform: false,
    open,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8, limiter: limitShift({ offset: 16 }) })
    ],
    whileElementsMounted: autoUpdate
  })
  // closeMs 0: a scrub closes the old card at once, so it never lingers beside the next one.
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context, { closeMs: 0 })
  const floatingRef = useMergeRefs([refs.setFloating, cardRef])
  const [preview, setPreview] = useState<SectionPreview | null>(null)

  useLayoutEffect(() => {
    refs.setReference(referenceEl)
  }, [referenceEl, refs])

  useLayoutEffect(() => {
    setPreview(isMounted && headingId ? buildSectionPreview(headingId) : null)
  }, [headingId, isMounted, label])

  if (!isMounted || !headingId) return null

  return (
    <FloatingPortal>
      <div
        ref={floatingRef}
        role="dialog"
        aria-label={label}
        data-toc-rail-preview={headingId}
        style={{ ...floatingStyles, ...transitionStyles }}
        className={twMerge(
          popoverPanelClassName,
          'w-80 max-w-[min(20rem,calc(100vw-3rem))] overflow-hidden p-0'
        )}
        onFocus={api.cardFocus}
        onBlur={api.cardBlur}
        onKeyDown={api.cardKeyDown}>
        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-start gap-2">
            <CloneHost node={preview?.heading ?? null} fallback={label} className={TITLE_CLASS} />
            <PreviewChatAction
              headingId={headingId}
              label={label}
              actionRef={actionRef}
              onClick={api.openChat}
            />
          </div>
          {preview?.body && <CloneHost node={preview.body} className={BODY_CLASS} />}
        </div>
        {preview?.media && <MediaWell media={preview.media} />}
      </div>
    </FloatingPortal>
  )
}
