import SidebarLoader from '@components/skeleton/SidebarLoader'
import CloseButton from '@components/ui/CloseButton'
import { PanelTabBar } from '@components/ui/PanelTabBar'
import { Icons } from '@icons'
import { useStore } from '@stores'
import { type ReactNode, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { HistoryAuthorsBody } from './components/HistoryAuthorsBody'
import { HistorySidebarBody } from './components/HistorySidebarBody'
import { useHistoryCompare } from './hooks/useHistoryCompare'
import { useHistorySidebarRows } from './hooks/useHistorySidebarRows'
import { useVersionContent } from './hooks/useVersionContent'
import { HISTORY_SIDEBAR_VIRTUALIZE_THRESHOLD } from './types'

function SidebarHeader({ count, onClose }: { count: number; onClose?: () => void }) {
  return (
    <header className="border-base-300 bg-base-200 sticky top-0 z-10 flex shrink-0 items-start gap-2 border-b px-3 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base-content text-base font-semibold sm:text-lg">Version History</h2>
        <p className="text-base-content/60 mt-0.5 text-xs sm:text-sm">
          {count} version{count !== 1 ? 's' : ''}
        </p>
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
  onClose,
  children
}: {
  className?: string
  count: number
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
        <SidebarHeader count={count} onClose={onClose} />
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
  const { historyList, activeVersion, rows, openDays, toggleDay, toggleSession } =
    useHistorySidebarRows()

  if (loadingHistory && historyList.length === 0) return <SidebarLoader />

  if (historyList.length === 0) {
    return (
      <SidebarFrame className={className} count={0} onClose={onClose}>
        <div className="flex flex-1 flex-col items-center justify-center space-y-3 px-4 py-8">
          <div className="bg-base-300/50 flex size-12 items-center justify-center rounded-full">
            <Icons.history className="text-base-content/40" size={24} aria-hidden />
          </div>
          <div className="text-center">
            <p className="text-base-content/60 font-medium">No versions yet</p>
            <p className="text-base-content/40 mt-1 max-w-[15rem] text-sm leading-relaxed">
              Saved revisions will appear here when you or collaborators edit this document.
            </p>
          </div>
        </div>
      </SidebarFrame>
    )
  }

  return (
    <SidebarFrame className={className} count={historyList.length} onClose={onClose}>
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
          virtualize={
            variant === 'desktop' && historyList.length >= HISTORY_SIDEBAR_VIRTUALIZE_THRESHOLD
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
