import { PanelTabBar, type PanelTabOption } from '@components/ui/PanelTabBar'
import { ScrollArea } from '@components/ui/ScrollArea'
import { usePanelTabSwipe } from '@hooks/usePanelTabSwipe'
import type { PanelSurfaceVariant } from '@types'
import type { ReactNode, Ref } from 'react'
import { Fragment, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

/** Lockstep with MOTION_PANEL_MS (200) — tab bar pill slide uses the same duration. */
const TAB_CONTENT_FADE_CLASS = 'motion-safe:animate-[doc-content-in_200ms_ease-out_both]' as const

type TabbedPanelBodyProps<TTab extends string, TItem> = {
  variant: PanelSurfaceVariant
  tabs: readonly PanelTabOption<TTab>[]
  activeTab: TTab
  onSelect: (tab: TTab) => void
  capitalize?: boolean
  items: readonly TItem[]
  getItemKey: (item: TItem) => string | number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  sentinelRef: Ref<HTMLDivElement>
  renderItem: (item: TItem) => ReactNode
  loadingSkeleton: ReactNode
  emptyState: ReactNode
  endMessage: string
}

export function TabbedPanelBody<TTab extends string, TItem>({
  variant,
  tabs,
  activeTab,
  onSelect,
  capitalize,
  items,
  getItemKey,
  isLoading,
  isLoadingMore,
  hasMore,
  sentinelRef,
  renderItem,
  loadingSkeleton,
  emptyState,
  endMessage
}: TabbedPanelBodyProps<TTab, TItem>) {
  const isSheet = variant === 'sheet'
  const { containerRef, slideStyle, scrollLocked, fadeEnter, isAnimating, handlers } =
    usePanelTabSwipe({
      enabled: isSheet,
      tabs,
      activeTab,
      onSelect
    })

  const handleTabSelect = useCallback(
    (tab: TTab) => {
      if (isAnimating) return
      onSelect(tab)
    },
    [isAnimating, onSelect]
  )

  const body = (
    <>
      <PanelTabBar<TTab>
        tabs={tabs}
        activeTab={activeTab}
        onSelect={handleTabSelect}
        capitalize={capitalize}
      />
      <ScrollArea
        className={twMerge('p-3', isSheet ? 'min-h-0 flex-1' : 'max-h-96 min-h-48')}
        style={scrollLocked ? { overflow: 'hidden' } : undefined}
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
        <div
          ref={isSheet ? containerRef : undefined}
          key={activeTab}
          style={slideStyle}
          className={fadeEnter ? TAB_CONTENT_FADE_CLASS : undefined}>
          {isLoading && items.length === 0 && loadingSkeleton}
          {emptyState}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
              ))}

              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-3">
                  {isLoadingMore && (
                    <div className="loading loading-spinner loading-sm text-primary" />
                  )}
                </div>
              )}

              {!hasMore && (
                <p className="text-base-content/40 py-3 text-center text-xs">{endMessage}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )

  if (!isSheet) {
    return body
  }

  return (
    <div className="flex min-h-0 flex-1 touch-pan-y flex-col" {...handlers}>
      {body}
    </div>
  )
}
