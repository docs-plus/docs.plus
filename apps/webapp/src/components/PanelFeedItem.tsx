import Button, { dangerGhostClassName } from '@components/ui/Button'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { Icons } from '@icons'
import { openChatFromLink } from '@services/openChatFromLink'
import { formatTimeAgo } from '@utils/formatTime'
import { buildBookmarkHref } from '@utils/link-helpers'
import { messagePreviewKind } from '@utils/messagePreview'
import { MOTION_OVERLAY_OUT_MS } from '@utils/motion'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'
import { LuLink } from 'react-icons/lu'

type PanelFeedItemProps = {
  children: ReactNode
  exiting?: boolean
  className?: string
}

/** No row hover: the card itself does nothing; only its buttons act. */
export function PanelFeedItem({ children, exiting = false, className }: PanelFeedItemProps) {
  return (
    <div
      className={twMerge(
        'rounded-box border-base-300 bg-base-100 flex w-full origin-top items-start gap-3 border p-3 motion-safe:transition-[opacity,transform] motion-safe:ease-in',
        exiting &&
          'pointer-events-none opacity-0 motion-safe:-translate-y-1 motion-safe:scale-[0.98]',
        className
      )}
      style={exiting ? { transitionDuration: `${MOTION_OVERLAY_OUT_MS}ms` } : undefined}>
      {children}
    </div>
  )
}

type PanelFeedActionsProps = {
  /** ISO time the card is about; shown as "time ago". */
  createdAt: string
  onView: () => void
  /** Defaults to "View". A system notice passes "Review". */
  viewLabel?: string
  disabled?: boolean
  /** Row actions between the time and View, as `PanelFeedRowAction`. */
  children?: ReactNode
}

/** The card's last row: time, row actions, then View in P6 ink, so a list shows no primaries. */
export function PanelFeedActions({
  createdAt,
  onView,
  viewLabel = 'View',
  disabled = false,
  children
}: PanelFeedActionsProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <time dateTime={createdAt} className="text-base-content/60 text-xs">
        {formatTimeAgo(createdAt)}
      </time>
      {children}
      <Button variant="quiet" className="ml-auto" onClick={onView} disabled={disabled}>
        {viewLabel}
      </Button>
    </div>
  )
}

type PanelFeedRowActionProps = {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}

/** A row action inside `PanelFeedActions`. `disabled` also marks it busy while the card exits. */
export function PanelFeedRowAction({
  onClick,
  disabled,
  danger,
  children
}: PanelFeedRowActionProps) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="xs"
      className={danger ? dangerGhostClassName : 'text-base-content/70'}
      disabled={disabled}
      aria-busy={disabled}>
      {children}
    </Button>
  )
}

/** The message preview row: an optional media tile, then the clamped text. */
export function PanelFeedPreview({ media, children }: { media: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 items-start gap-2">
      {media}
      <p className="bg-base-200 text-base-content/70 rounded-field line-clamp-2 min-w-0 flex-1 px-2 py-1 text-sm">
        {children}
      </p>
    </div>
  )
}

type PanelFeedCopyLinkProps = {
  messageId: string | null
  channelId: string | null
  disabled?: boolean
}

/** Copies the message deep link. The URL is built at click time, from the page the reader is on. */
export function PanelFeedCopyLink({ messageId, channelId, disabled }: PanelFeedCopyLinkProps) {
  const { copy, copied } = useCopyToClipboard({
    successMessage: 'URL copied to clipboard',
    errorMessage: 'Failed to copy URL'
  })

  const handleCopy = () => {
    // A carrier has no message, so half a link opens nothing.
    if (!messageId || !channelId) return
    void copy(buildBookmarkHref({ messageId, channelId }))
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className="text-base-content/70 hover:text-base-content shrink-0"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={copied ? 'Copied!' : 'Copy link'}>
      <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
        <Icons.check size={14} className="swap-on text-success" />
        <LuLink size={14} className="swap-off rotate-45" />
      </span>
    </Button>
  )
}

/** Opens the chat at one message. An open room on that heading is torn down first, so it refetches. */
export function openChatAtMessage(channelId: string | null, messageId: string | null) {
  if (!channelId) return
  void openChatFromLink(channelId, {
    fetchMsgsFromId: messageId ?? undefined,
    scroll2Heading: true,
    reopen: true
  })
}

/** The glyph tile that stands in for an attachment with no image thumb. */
export function PanelFeedMediaHint({ preview }: { preview: string | null | undefined }) {
  const kind = messagePreviewKind(preview ?? '')
  if (!kind) return null

  const Icon =
    kind === 'image'
      ? Icons.image
      : kind === 'video'
        ? Icons.video
        : kind === 'audio'
          ? Icons.music
          : Icons.fileText

  return (
    <div
      className="bg-base-300/40 rounded-field flex size-10 shrink-0 items-center justify-center"
      aria-hidden>
      <Icon size={18} className="text-base-content/70" />
    </div>
  )
}
