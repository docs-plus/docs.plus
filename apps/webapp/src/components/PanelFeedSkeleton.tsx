import { TextLine } from '@components/ui/TextLine'

function PanelFeedItemSkeleton({ typeIcon }: { typeIcon: boolean }) {
  return (
    <div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
      <div className="skeleton size-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex h-5 items-center gap-1.5">
              {typeIcon && <div className="skeleton size-3.5" />}
              <div className="skeleton h-3.5 w-28" />
            </div>
            <div className="bg-base-200 rounded-field px-2 py-1">
              <TextLine bone="h-3.5 w-full" />
            </div>
          </div>
          <div className="skeleton rounded-field size-8 shrink-0" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton rounded-field h-6 w-20" />
          <div className="skeleton ml-auto h-3.5 w-8" />
        </div>
      </div>
    </div>
  )
}

type PanelFeedSkeletonProps = {
  count?: number
  /** Notifications lead the name with a 14px type glyph; bookmarks do not. */
  typeIcon?: boolean
}

/** Bones that mirror `PanelFeedItem` + `PanelFeedActions`, for a feed's first load. */
export function PanelFeedSkeleton({ count = 3, typeIcon = false }: PanelFeedSkeletonProps) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <PanelFeedItemSkeleton key={index} typeIcon={typeIcon} />
      ))}
    </div>
  )
}
