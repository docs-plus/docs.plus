import { ScrollArea } from '@components/ui/ScrollArea'
import { useHashRouter } from '@hooks/useHashRouter'
import { useStore } from '@stores'
import { useEffect, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

import type { HistorySidebarRowHandlers, SidebarRow } from '../types'
import { findActiveVersionRowIndex, sidebarRowKey } from '../utils/sidebarRows'
import { HistorySidebarRowItem } from './HistorySidebarRowItem'

type HistorySidebarBodyProps = HistorySidebarRowHandlers & {
  rows: SidebarRow[]
  virtualize: boolean
}

export function HistorySidebarBody({ rows, virtualize, ...rowHandlers }: HistorySidebarBodyProps) {
  const { requestedVersion } = useHashRouter()
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const scrollGateRef = useRef<{ documentId: string | undefined; done: boolean }>({
    documentId: undefined,
    done: false
  })

  useEffect(() => {
    if (scrollGateRef.current.documentId !== documentId) {
      scrollGateRef.current = { documentId, done: false }
    }
    if (scrollGateRef.current.done || rows.length === 0) return

    const scrollTarget = requestedVersion ?? rowHandlers.activeVersion
    const index = findActiveVersionRowIndex(rows, scrollTarget)
    if (index < 0) return

    scrollGateRef.current.done = true

    if (virtualize) {
      virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'auto' })
      return
    }

    document
      .querySelector(`[data-history-sidebar-row-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [documentId, virtualize, requestedVersion, rowHandlers.activeVersion, rows])

  if (virtualize) {
    return (
      <div className="min-h-0 flex-1" data-testid="history-sidebar-virtualized">
        <Virtuoso
          ref={virtuosoRef}
          data={rows}
          className="scrollbar-custom scrollbar-thin h-full"
          style={{ height: '100%' }}
          increaseViewportBy={200}
          itemContent={(index, row) => (
            <div data-history-sidebar-row-index={index}>
              <HistorySidebarRowItem row={row} {...rowHandlers} />
            </div>
          )}
        />
      </div>
    )
  }

  return (
    <ScrollArea
      className="min-h-0 flex-1 !pt-0"
      scrollbarSize="thin"
      hideScrollbar
      data-testid="history-sidebar-static">
      {rows.map((row, index) => (
        <div key={sidebarRowKey(row, index)} data-history-sidebar-row-index={index}>
          <HistorySidebarRowItem row={row} {...rowHandlers} />
        </div>
      ))}
    </ScrollArea>
  )
}
