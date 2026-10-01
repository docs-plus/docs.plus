import { PanelTabBar, type PanelTabOption } from '@components/ui/PanelTabBar'
import { ScrollArea } from '@components/ui/ScrollArea'
import { usePanelTabSwipe } from '@hooks/usePanelTabSwipe'
import type { PanelSurfaceVariant } from '@types'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'
import type { ReactNode, Ref } from 'react'
import { Fragment, useCallback } from 'react'

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
  /** The first load failed. The error state then replaces the empty state. */
  isError?: boolean
  /** Shown after loading and before empty: `EmptyState tone="error"` with Try again. */
  errorState?: ReactNode
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
  isError = false,
  errorState
}: TabbedPanelBodyProps<TTab, TItem>) {
  const isSheet = variant === 'sheet'
  const isEmpty = !isLoading && items.length === 0
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
        className={
          isSheet ? `min-h-0 flex-1 py-3 ${sheetBodyPadClassName}` : 'max-h-96 min-h-48 p-3'
        }
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
          {isEmpty && (isError && errorState ? errorState : emptyState)}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
              ))}

              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-3">
                  {isLoadingMore && <div className="loading loading-spinner loading-sm" />}
                </div>
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
