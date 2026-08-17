import { SheetLayout } from '@components/SheetLayout'
import { useBottomSheet } from '@hooks/useBottomSheet'

import { HistorySidebarBody } from '../components/HistorySidebarBody'
import { useHistoryCompare } from '../hooks/useHistoryCompare'
import { useHistorySidebarRows } from '../hooks/useHistorySidebarRows'

/** Mobile compare picker. Tap sets A and closes. The viewed version is not a pick. */
export default function HistoryCompareSheet() {
  const { close } = useBottomSheet()
  const { enterCompare } = useHistoryCompare()
  const { historyList, activeVersion, rows, openDays, toggleDay, toggleSession } =
    useHistorySidebarRows()

  return (
    <SheetLayout title="Compare with" onClose={close} fillHeight bodyClassName="overflow-hidden">
      {historyList.length === 0 ? (
        <p className="text-base-content/60 px-4 py-6 text-sm">No versions yet</p>
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
