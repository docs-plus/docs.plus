import { useHistoryHash } from '@components/pages/history/historyShareUrl'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { useEffect, useMemo, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

import type { HistorySidebarRowHandlers, SidebarRow } from '../types'
import { findActiveVersionRowIndex, sidebarRowKey } from '../utils/sidebarRows'
import { HistorySidebarRowItem } from './HistorySidebarRowItem'

type HistorySidebarBodyProps = HistorySidebarRowHandlers & {
  rows: SidebarRow[]
  virtualize: boolean
  hasMore?: boolean
  onShowOlder?: () => void
}

function OlderVersionsButton({ onShowOlder }: { onShowOlder?: () => void }) {
  if (!onShowOlder) return null
  return (
    <div className="px-3 py-2">
      <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onShowOlder}>
        Show older versions
      </button>
    </div>
  )
}

export function HistorySidebarBody({
  rows,
  virtualize,
  hasMore,
  onShowOlder,
  ...rowHandlers
}: HistorySidebarBodyProps) {
  const { version } = useHistoryHash()
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const listRootRef = useRef<HTMLDivElement>(null)
  const scrollGateRef = useRef<{ documentId: string | undefined; done: boolean }>({
    documentId: undefined,
    done: false
  })

  useEffect(() => {
    if (scrollGateRef.current.documentId !== documentId) {
      scrollGateRef.current = { documentId, done: false }
    }
    if (scrollGateRef.current.done || rows.length === 0) return

    const scrollTarget = version ?? rowHandlers.activeVersion
    const index = findActiveVersionRowIndex(rows, scrollTarget)
    if (index < 0) return

    scrollGateRef.current.done = true

    if (virtualize) {
      virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'auto' })
      return
    }

    listRootRef.current
      ?.querySelector(`[data-history-sidebar-row-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [documentId, virtualize, version, rowHandlers.activeVersion, rows])

  // A new Footer function each render is a new component type, so Virtuoso remounts it.
  const virtuosoComponents = useMemo(
    () =>
      hasMore ? { Footer: () => <OlderVersionsButton onShowOlder={onShowOlder} /> } : undefined,
    [hasMore, onShowOlder]
  )

  if (virtualize) {
    return (
      <div className="min-h-0 flex-1" data-testid="history-sidebar-virtualized">
        <Virtuoso
          ref={virtuosoRef}
          data={rows}
          className="scrollbar-custom h-full scrollbar-thin"
          style={{ height: '100%' }}
          increaseViewportBy={200}
          itemContent={(index, row) => (
            <div data-history-sidebar-row-index={index}>
              <HistorySidebarRowItem row={row} {...rowHandlers} />
            </div>
          )}
          components={virtuosoComponents}
        />
      </div>
    )
  }

  return (
    <ScrollArea
      ref={listRootRef}
      className="min-h-0 flex-1 !pt-0"
      scrollbarSize="thin"
      hideScrollbar
      data-testid="history-sidebar-static">
      {rows.map((row, index) => (
        <div key={sidebarRowKey(row, index)} data-history-sidebar-row-index={index}>
          <HistorySidebarRowItem row={row} {...rowHandlers} />
        </div>
      ))}
      {hasMore ? <OlderVersionsButton onShowOlder={onShowOlder} /> : null}
    </ScrollArea>
  )
}
