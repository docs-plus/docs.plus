import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

import { AccentBlockSkeleton, AccentPanelSkeleton } from './ChatroomFeedMediaSkeleton'

type Props = {
  variant?: keyof ChatroomVariant
  className?: string
  count?: number
}

function DayChipSkeleton() {
  return (
    <div className="flex justify-center py-2" aria-hidden>
      <div className="skeleton h-4 w-14 rounded-full" />
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
  const widths = ['w-[76%]', 'w-[54%]', 'w-[40%]']
  return (
    <div className={twMerge('flex flex-col gap-1.5', align === 'end' && 'items-end')}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={twMerge(
            'skeleton h-3 rounded-md',
            align === 'end' ? 'w-28' : (widths[index] ?? 'w-[45%]')
          )}
        />
      ))}
    </div>
  )
}

function SkeletonBody({
  accent,
  lines = 2,
  align = 'start',
  panelClassName
}: {
  accent?: 'block' | 'panel'
  lines?: number
  align?: 'start' | 'end'
  panelClassName?: string
}) {
  if (accent === 'panel') return <AccentPanelSkeleton className={panelClassName} />
  if (accent === 'block') return <AccentBlockSkeleton />
  return <TextLinesSkeleton lines={lines} align={align} />
}

function DesktopGroupStartSkeleton({
  lines = 2,
  accent
}: {
  lines?: number
  accent?: 'block' | 'panel'
}) {
  return (
    <div className="flex w-full items-start gap-1.5 px-2.5 py-1.5" aria-hidden>
      <div className="skeleton size-8 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="skeleton h-2.5 w-16 rounded-md" />
          <div className="skeleton h-2 w-7 rounded-md" />
        </div>
        <SkeletonBody accent={accent} lines={lines} />
      </div>
    </div>
  )
}

function DesktopCompactSkeleton() {
  return (
    <div className="flex w-full items-start gap-1.5 px-2.5 py-1" aria-hidden>
      <div className="w-8 shrink-0" aria-hidden />
      <div className="skeleton h-3 w-[62%] rounded-md" />
    </div>
  )
}

function MobileIncomingSkeleton({
  groupStart = true,
  accent
}: {
  groupStart?: boolean
  accent?: 'block' | 'panel'
}) {
  return (
    <div className={twMerge('flex w-full gap-2 px-2', groupStart ? 'mt-1' : 'mt-0.5')} aria-hidden>
      {groupStart ? (
        <div className="skeleton size-8 shrink-0 rounded-full" />
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-px">
        {groupStart && <div className="skeleton h-2.5 w-14 rounded-md" />}
        <SkeletonBody
          accent={accent}
          lines={groupStart ? 2 : 1}
          panelClassName={accent === 'panel' ? 'max-w-full' : undefined}
        />
      </div>
    </div>
  )
}

function MobileOutgoingSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="mt-1 flex w-full justify-end px-2" aria-hidden>
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
  | { kind: 'desktop-accent'; accent: 'block' | 'panel' }
  | { kind: 'mobile-in'; groupStart?: boolean }
  | { kind: 'mobile-accent'; accent: 'block' | 'panel' }
  | { kind: 'mobile-out'; lines?: number }

const DESKTOP_ROWS: RowSpec[] = [
  { kind: 'day' },
  { kind: 'desktop-start', lines: 2 },
  { kind: 'desktop-compact' },
  { kind: 'desktop-accent', accent: 'panel' },
  { kind: 'desktop-compact' },
  { kind: 'desktop-start', lines: 1 },
  { kind: 'desktop-compact' }
]

const MOBILE_ROWS: RowSpec[] = [
  { kind: 'day' },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-in', groupStart: false },
  { kind: 'mobile-out', lines: 2 },
  { kind: 'mobile-accent', accent: 'block' },
  { kind: 'mobile-in', groupStart: true },
  { kind: 'mobile-in', groupStart: false },
  { kind: 'mobile-out', lines: 1 },
  { kind: 'mobile-accent', accent: 'panel' },
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
      return <DayChipSkeleton key={index} />
    case 'desktop-start':
      return <DesktopGroupStartSkeleton key={index} lines={spec.lines} />
    case 'desktop-compact':
      return <DesktopCompactSkeleton key={index} />
    case 'desktop-accent':
      return <DesktopGroupStartSkeleton key={index} accent={spec.accent} />
    case 'mobile-in':
      return <MobileIncomingSkeleton key={index} groupStart={spec.groupStart} />
    case 'mobile-accent':
      return <MobileIncomingSkeleton key={index} groupStart accent={spec.accent} />
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
        'flex min-h-0 flex-1 flex-col px-1 pb-3',
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
