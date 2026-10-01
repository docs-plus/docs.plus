import { SheetLayout } from '@components/SheetLayout'
import { EmptyState } from '@components/ui/EmptyState'
import { Icons } from '@icons'
import { useSheetStore } from '@stores'

import { HistorySidebarBody } from '../components/HistorySidebarBody'
import { useHistoryCompare } from '../hooks/useHistoryCompare'
import { useHistorySidebarRows } from '../hooks/useHistorySidebarRows'

/** Mobile compare picker. Tap sets A and closes. The viewed version is not a pick. */
export default function HistoryCompareSheet() {
  const close = useSheetStore((state) => state.closeSheet)
  const { enterCompare } = useHistoryCompare()
  const { historyList, activeVersion, rows, openDays, toggleDay, toggleSession } =
    useHistorySidebarRows()

  return (
    <SheetLayout title="Compare with" onClose={close} fillHeight bodyClassName="overflow-hidden">
      {historyList.length === 0 ? (
        <EmptyState
          icon={Icons.history}
          title="No versions yet."
          body="Saved revisions will appear here when you or collaborators edit this document."
          className="flex-1 justify-center"
        />
      ) : (
        <HistorySidebarBody
          rows={rows}
          virtualize={false}
          activeVersion={activeVersion}
          latestVersion={historyList[0].version}
          openDays={openDays}
          onToggleDay={toggleDay}
          onToggleSession={toggleSession}
          comparePick
          onSelectVersion={(version) => {
            if (enterCompare(version)) close()
          }}
        />
      )}
    </SheetLayout>
  )
}
