import CloseButton from '@components/ui/CloseButton'
import { EmptyState } from '@components/ui/EmptyState'
import { PanelTabBar } from '@components/ui/PanelTabBar'
import { Icons } from '@icons'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { type ReactNode, useState } from 'react'

import { HistoryAuthorsBody } from './components/HistoryAuthorsBody'
import { HistorySidebarBody } from './components/HistorySidebarBody'
import { HistorySidebarSkeleton } from './components/HistorySidebarSkeleton'
import { useDocumentHistory } from './hooks/useDocumentHistory'
import { useHistoryCompare } from './hooks/useHistoryCompare'
import { useHistorySidebarRows } from './hooks/useHistorySidebarRows'
import { useVersionContent } from './hooks/useVersionContent'
import { HISTORY_SIDEBAR_VIRTUALIZE_THRESHOLD } from './types'

function SidebarHeader({
  count,
  hasMore,
  onClose
}: {
  count: number | null
  hasMore?: boolean
  onClose?: () => void
}) {
  return (
    <header className="border-base-300 bg-base-200 sticky top-0 z-10 flex shrink-0 items-start gap-2 border-b px-3 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base-content text-base font-semibold">Version History</h2>
        {count === null ? (
          <div className="mt-0.5 flex h-5 items-center">
            <div className="skeleton h-3 w-20" />
          </div>
        ) : (
          <p className="text-base-content/60 text-meta mt-0.5">
            {hasMore ? `${count}+ versions` : `${count} version${count !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
      {onClose && (
        <CloseButton
          onClick={onClose}
          size="sm"
          iconSize={20}
          aria-label="Close history"
          className="-mt-1 -mr-1 shrink-0"
        />
      )}
    </header>
  )
}

function SidebarFrame({
  className,
  count,
  hasMore,
  onClose,
  children
}: {
  className?: string
  count: number | null
  hasMore?: boolean
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <div
      className={twMerge(
        'sidebar bg-base-200 border-base-300 h-full min-h-0 w-[25%] shrink-0 border-l',
        className
      )}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden motion-safe:animate-[doc-content-in_200ms_ease-out_both]">
        <SidebarHeader count={count} hasMore={hasMore} onClose={onClose} />
        {children}
      </div>
    </div>
  )
}

type HistoryTab = 'Versions' | 'Authors'
const HISTORY_TABS = [{ label: 'Versions' as const }, { label: 'Authors' as const }]

const HistorySidebar = ({
  className,
  onClose,
  variant = 'desktop'
}: {
  className?: string
  onClose?: () => void
  variant?: 'desktop' | 'mobile'
}) => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const { watchVersionContent } = useVersionContent()
  const { compareMode, selectCompareBase } = useHistoryCompare()
  const [tab, setTab] = useState<HistoryTab>('Versions')
  const historyHasMore = useStore((state) => state.historyHasMore)
  const { fetchOlderHistory } = useDocumentHistory()
  const { historyList, activeVersion, rows, openDays, toggleDay, toggleSession } =
    useHistorySidebarRows()

  // The loader sits inside the real frame, so the swap to rows moves nothing.
  if (loadingHistory && historyList.length === 0) {
    return (
      <SidebarFrame className={className} count={null} onClose={onClose}>
        <HistorySidebarSkeleton tabs={variant === 'desktop'} />
      </SidebarFrame>
    )
  }

  if (historyList.length === 0) {
    return (
      <SidebarFrame className={className} count={0} onClose={onClose}>
        <EmptyState
          icon={Icons.history}
          title="No versions yet."
          body="Saved revisions will appear here when you or collaborators edit this document."
          className="flex-1 justify-center"
        />
      </SidebarFrame>
    )
  }

  return (
    <SidebarFrame
      className={className}
      count={historyList.length}
      hasMore={historyHasMore}
      onClose={onClose}>
      {/* Desktop only: Authors needs a roster that does not fit the mobile drawer.
          Compare marks now mount on mobile; this tab stays desktop until designed. */}
      {variant === 'desktop' && (
        <PanelTabBar
          tabs={HISTORY_TABS}
          activeTab={tab}
          onSelect={(next) => setTab(next as HistoryTab)}
        />
      )}

      {variant === 'desktop' && tab === 'Authors' ? (
        <HistoryAuthorsBody />
      ) : (
        <HistorySidebarBody
          rows={rows}
          hasMore={historyHasMore}
          onShowOlder={fetchOlderHistory}
          // Virtualize while more pages exist, so one Show older press does not swap trees.
          virtualize={
            variant === 'desktop' &&
            (historyHasMore || historyList.length >= HISTORY_SIDEBAR_VIRTUALIZE_THRESHOLD)
          }
          activeVersion={activeVersion}
          latestVersion={historyList[0].version}
          openDays={openDays}
          onToggleDay={toggleDay}
          onToggleSession={toggleSession}
          onSelectVersion={(version) => {
            // Desktop compare: a row click reassigns A. Mobile compare picks A in the
            // sheet; this drawer always watches B.
            if (variant === 'desktop' && compareMode) {
              selectCompareBase(version)
              return
            }
            watchVersionContent(version)
            onClose?.()
          }}
        />
      )}
    </SidebarFrame>
  )
}

export default HistorySidebar
