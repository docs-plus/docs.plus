import SidebarLoader from '@components/skeleton/SidebarLoader'
import { useStore } from '@stores'
import React, { useEffect } from 'react'
import { MdCalendarToday, MdAccessTime } from 'react-icons/md'
import {
  dayContainsCurrentVersion,
  groupContainsCurrentVersion,
  groupHistoryByDay
} from '../helpers'
import { useVersionContent } from '../hooks/useVersionContent'
import { twMerge } from 'tailwind-merge'
import { useModal } from '@components/ui/ModalDrawer'
const Sidebar = ({ className }: { className?: string }) => {
  const { loadingHistory, activeHistory, historyList } = useStore((state) => state)
  const { watchVersionContent } = useVersionContent()
  const { close: closeModal } = useModal() || {}

  if (loadingHistory || !activeHistory) return <SidebarLoader />

  return (
    <div
      className={twMerge('sidebar h-full w-[25%] border-l border-gray-200 bg-base-100', className)}>
      <div className="flex h-full flex-col">
        <div className="h-[94px] border-gray-200 p-4">
          <h2 className="mb-2 text-2xl font-bold text-base-content">Version History</h2>
          <p className="text-sm font-medium text-base-content/60">Auto versioning enabled</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="menu w-full rounded-box">
            {Object.entries(groupHistoryByDay(historyList)).map(([date, hourGroups], dateIndex) => (
              <li key={date}>
                <details open={dayContainsCurrentVersion(hourGroups, activeHistory.version)}>
                  <summary className="font-medium">
                    <MdCalendarToday className="h-4 w-4" />
                    {date}
                  </summary>
                  <ul>
                    {Object.entries(hourGroups).map(([hour, items], hourIndex) => (
                      <li key={`${date}-${hour}`}>
                        <details open={groupContainsCurrentVersion(items, activeHistory.version)}>
                          <summary className="text-sm font-medium">
                            <MdAccessTime className="h-4 w-4" />
                            {hour}
                          </summary>
                          <ul>
                            {items.map((item) => (
                              <li key={item.version}>
                                <button
                                  onClick={() => {
                                    watchVersionContent(item.version)
                                    closeModal && closeModal()
                                  }}
                                  className={`w-full p-3 ${activeHistory.version === item.version ? 'active text-primary' : ''}`}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">Version {item.version}</span>
                                    <span
                                      className={`text-xs ${
                                        activeHistory.version === item.version
                                          ? 'text-primary'
                                          : 'text-base-content/60'
                                      }`}>
                                      {new Date(item.createdAt).toLocaleTimeString()}
                                    </span>
                                    {item.commitMessage && (
                                      <span className="mt-1 text-sm">{item.commitMessage}</span>
                                    )}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
