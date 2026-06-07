import { PanelTabBar, type PanelTabOption } from '@components/ui/PanelTabBar'
import { ScrollArea } from '@components/ui/ScrollArea'
import type { PanelSurfaceVariant } from '@types'
import type { ReactNode, Ref } from 'react'
import { Fragment } from 'react'
import { twMerge } from 'tailwind-merge'

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

  return (
    <>
      <PanelTabBar<TTab>
        tabs={tabs}
        activeTab={activeTab}
        onSelect={onSelect}
        capitalize={capitalize}
      />
      <ScrollArea
        className={twMerge('p-3', isSheet ? 'min-h-0 flex-1' : 'max-h-96 min-h-48')}
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
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

            {!hasMore && items.length > 0 && (
              <p className="text-base-content/40 py-3 text-center text-xs">{endMessage}</p>
            )}
          </div>
        )}
      </ScrollArea>
    </>
  )
}
