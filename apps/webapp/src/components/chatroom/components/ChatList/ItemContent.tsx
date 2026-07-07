import type { ChatItem } from '@components/chatroom/types/chat-items'
import { isDay, isMessage, isUnread } from '@components/chatroom/types/chat-items'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import type { TGroupedMsgRow } from '@types'
import { useMemo } from 'react'

import { DesktopMessageBody } from './DesktopMessageBody'
import { FeedSeparator } from './FeedSeparator'
import { MobileMessageBody } from './MobileMessageBody'
import { SystemNotifyChip } from './SystemNotifyChip'

export type ItemContentContext = {
  channelId: string
  retry: (clientId: string) => void
  currentUserId: string | null
  variant: keyof ChatroomVariant
}

export type ItemContentProps = {
  index: number
  data: ChatItem | null | undefined
  prevData?: ChatItem | null
  context?: ItemContentContext
}

/**
 * Kind-dispatched render. Author-grouping is render-time: compact mode
 * fires when prev item is a same-author message. `MessageCard` owns the
 * desktop default body; mobile injects the chat-bubble shell via
 * `MobileMessageBody` children.
 *
 * Virtuoso's typed contract says `data: Data`, but during in-flight
 * `data.replace` transitions the slot is briefly undefined; render null
 * rather than throwing inside `isDay`.
 */
export const ItemContent = ({ index, data, prevData, context }: ItemContentProps) => {
  // A notification chip between two same-author messages must break the
  // group — otherwise the post-notification message would render compact
  // (no avatar/header) and visually merge across the chip. Mirrors the
  // grouped-projection rule for notification breaks.
  const samePrev =
    !!data &&
    isMessage(data) &&
    !!prevData &&
    isMessage(prevData) &&
    (prevData.row as any).type !== 'notification' &&
    (prevData.row as any).user_id === (data.row as any).user_id
  const compact = Boolean(samePrev)
  const currentUserId = context?.currentUserId ?? null
  const variant = context?.variant ?? 'desktop'
  const row = data && isMessage(data) ? data.row : null
  const status = data && isMessage(data) ? data.status : undefined
  const clientId = data && isMessage(data) ? (data.client_id ?? null) : null
  const rowId = (row as any)?.id
  const rowReactions = (row as any)?.reactions
  const rowHtml = (row as any)?.html
  const rowDeletedAt = (row as any)?.deleted_at
  const rowEditedAt = (row as any)?.edited_at
  // Memo keeps `grouped` referentially stable across parent re-renders so
  // MessageCard.memo can short-circuit. `status`/`client_id` are folded
  // in so MessageFailedRow + Timestamp status icons read off `message`.
  const grouped = useMemo<TGroupedMsgRow | null>(() => {
    if (!row) return null
    return {
      ...(row as any),
      status,
      client_id: clientId,
      isGroupStart: !compact,
      isGroupEnd: true,
      isNewGroupById: false,
      isOwner: row.user_id != null && row.user_id === currentUserId
    } as TGroupedMsgRow
    // Sub-field deps invalidate the memo when realtime mutates fields on a
    // stable `row` reference (reactions arrays, soft-delete, edit). Linter
    // sees them as "unused" because the spread reads them via `...row`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row,
    rowId,
    rowReactions,
    rowHtml,
    rowDeletedAt,
    rowEditedAt,
    compact,
    currentUserId,
    status,
    clientId
  ])
  if (!data) return null
  if (isDay(data)) return <FeedSeparator variant="day" date={data.date} />
  if (isUnread(data)) return <FeedSeparator variant="unread" />
  if (isMessage(data) && (data.row as any).type === 'notification') {
    return <SystemNotifyChip message={data.row} variant={variant} />
  }
  if (isMessage(data) && grouped) {
    const onRetry = data.client_id ? () => context?.retry(data.client_id!) : undefined
    if (variant === 'mobile') {
      return (
        <MobileMessageBody
          index={index}
          message={grouped}
          compact={compact}
          status={data.status}
          onRetry={onRetry}
        />
      )
    }
    return (
      <DesktopMessageBody
        index={index}
        grouped={grouped}
        compact={compact}
        status={data.status}
        onRetry={onRetry}
      />
    )
  }
  return null
}
