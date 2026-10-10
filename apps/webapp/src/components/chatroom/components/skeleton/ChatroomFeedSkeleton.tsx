import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from '@utils/twMerge'

type Props = {
  variant?: keyof ChatroomVariant
  className?: string
  count?: number
}

/** The real FeedSeparator row: two hairlines and a 12px label, of which only the label is a bone. */
function DaySeparatorSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-2" aria-hidden>
      <span className="bg-base-300/80 h-px flex-1" />
      <span className="flex h-4 shrink-0 items-center">
        <span className="skeleton h-3 w-16" />
      </span>
      <span className="bg-base-300/80 h-px flex-1" />
    </div>
  )
}

const LINE_WIDTHS = ['w-[76%]', 'w-[54%]', 'w-[40%]']

/** One body line: a 16px bone in the real 24px line box (`.message--card__content p`). */
function BodyLine({ width }: { width: string }) {
  return (
    <div className="flex h-6 items-center">
      <div className={twMerge('skeleton h-4', width)} />
    </div>
  )
}

function TextLinesSkeleton({
  lines = 2,
  align = 'start'
}: {
  lines?: number
  align?: 'start' | 'end'
}) {
  return (
    <div className={twMerge('flex w-full flex-col', align === 'end' && 'items-end')}>
      {Array.from({ length: lines }).map((_, index) => (
        <BodyLine
          key={index}
          width={align === 'end' ? 'w-28' : (LINE_WIDTHS[index] ?? 'w-[45%]')}
        />
      ))}
    </div>
  )
}

/**
 * Mirrors DesktopMessageBody: a `w-10` rail beside the content column, inside the `px-3` card.
 * `pb-1` stands for the empty footer, whose indicators row always keeps its `mt-1`.
 */
function DesktopGroupStartSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex w-full items-start gap-2 px-3 py-1" aria-hidden>
      <div className="flex w-10 shrink-0 flex-col items-center">
        <div className="skeleton size-10 rounded-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col pb-1">
        <div className="flex h-5 items-center">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton ml-1 h-3 w-8" />
        </div>
        <TextLinesSkeleton lines={lines} />
      </div>
    </div>
  )
}

function DesktopCompactSkeleton() {
  return (
    <div className="flex w-full items-start gap-2 px-3 py-0.5" aria-hidden>
      <div className="w-10 shrink-0" />
      <div className="min-w-0 flex-1 pb-1">
        <BodyLine width="w-[62%]" />
      </div>
    </div>
  )
}

/** The mobile card has no inline padding, so the avatar sits on the list edge. */
function MobileIncomingSkeleton({ groupStart = true }: { groupStart?: boolean }) {
  return (
    <div className={twMerge('flex w-full gap-3', groupStart ? 'mt-1' : 'mt-0.5')} aria-hidden>
      {groupStart ? (
        <div className="skeleton size-10 shrink-0 rounded-full" />
      ) : (
        <span className="size-10 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {groupStart && (
          <div className="flex h-4 items-center">
            <div className="skeleton h-3 w-14" />
          </div>
        )}
        <TextLinesSkeleton lines={groupStart ? 2 : 1} />
      </div>
    </div>
  )
}

function MobileOutgoingSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="mt-1 flex w-full justify-end" aria-hidden>
      <div className="max-w-[78%] min-w-[55%]">
        <TextLinesSkeleton lines={lines} align="end" />
      </div>
    </div>
  )
}

type RowSpec =
  | { kind: 'day' }
  | { kind: 'desktop-start'; lines?: number }
  | { kind: 'desktop-compact' }
  | { kind: 'mobile-in'; groupStart?: boolean }
  | { kind: 'mobile-out'; lines?: number }

const DESKTOP_ROWS: RowSpec[] = [
  { kind: 'day' },
  { kind: 'desktop-start', lines: 2 },
  { kind: 'desktop-compact' },
  { kind: 'desktop-start', lines: 2 },
  { kind: 'desktop-compact' },
  { kind: 'desktop-start', lines: 1 },
  { kind: 'desktop-compact' }
]

const MOBILE_ROWS: RowSpec[] = [
  { kind: 'day' },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-in', groupStart: false },
  { kind: 'mobile-out', lines: 2 },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-in', groupStart: false },
  { kind: 'mobile-out', lines: 1 },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-in', groupStart: false },
  { kind: 'mobile-out', lines: 2 },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-out', lines: 1 },
  { kind: 'mobile-in', groupStart: false }
]

function renderRow(spec: RowSpec, index: number) {
  switch (spec.kind) {
    case 'day':
      return <DaySeparatorSkeleton key={index} />
    case 'desktop-start':
      return <DesktopGroupStartSkeleton key={index} lines={spec.lines} />
    case 'desktop-compact':
      return <DesktopCompactSkeleton key={index} />
    case 'mobile-in':
      return <MobileIncomingSkeleton key={index} groupStart={spec.groupStart} />
    case 'mobile-out':
      return <MobileOutgoingSkeleton key={index} lines={spec.lines} />
    default: {
      const _exhaustive: never = spec
      return _exhaustive
    }
  }
}

export const ChatroomFeedSkeleton = ({ variant = 'desktop', className, count }: Props) => {
  const isMobile = variant === 'mobile'
  const template = isMobile ? MOBILE_ROWS : DESKTOP_ROWS
  const rows = count != null ? template.slice(0, count) : template

  return (
    <div
      className={twMerge(
        'flex min-h-0 flex-1 flex-col pb-3',
        isMobile
          ? 'scrollbar-custom scrollbar-thin justify-start overflow-y-auto pt-2'
          : 'justify-end overflow-hidden pt-1.5',
        className
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading messages">
      {rows.map((spec, index) => renderRow(spec, index))}
    </div>
  )
}
