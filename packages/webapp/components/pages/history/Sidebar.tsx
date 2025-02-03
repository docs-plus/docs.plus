import SidebarLoader from '@components/skeleton/SidebarLoader'
import React from 'react'
import { MdRestore, MdCalendarToday, MdAccessTime } from 'react-icons/md'

interface HistoryItem {
  version: number
  createdAt: string
  commitMessage?: string
}

interface SidebarProps {
  isLoading: boolean
  history: HistoryItem[]
  currentVersion: number | null
  watchVersionContent: (version: number) => void
}

interface GroupedHistory {
  [date: string]: {
    [hour: string]: HistoryItem[]
  }
}

const groupHistoryByDay = (history: HistoryItem[]): GroupedHistory => {
  return history.reduce((groups, item) => {
    const date = new Date(item.createdAt)
    const dayKey = date.toLocaleDateString(navigator.language, {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const hourKey = date.toLocaleTimeString(navigator.language, {
      hour: 'numeric',
      hour12: true
    })

    if (!groups[dayKey]) {
      groups[dayKey] = {}
    }
    if (!groups[dayKey][hourKey]) {
      groups[dayKey][hourKey] = []
    }
    groups[dayKey][hourKey].push(item)
    return groups
  }, {} as GroupedHistory)
}

const Sidebar: React.FC<SidebarProps> = ({
  isLoading,
  history,
  currentVersion,
  watchVersionContent
}) => {
  // Add helper function to check if a group contains the current version
  const groupContainsCurrentVersion = (items: HistoryItem[]) => {
    return items.some((item) => item.version === currentVersion)
  }

  // Add helper function to check if any hour in a day contains the current version
  const dayContainsCurrentVersion = (hourGroups: { [hour: string]: HistoryItem[] }) => {
    return Object.values(hourGroups).some((items) => groupContainsCurrentVersion(items))
  }

  if (isLoading) return <SidebarLoader />

  return (
    <div className="sidebar h-full w-[25%] border-l border-gray-200 bg-base-100">
      <div className="flex h-full flex-col">
        <div className="h-[94px] border-gray-200 p-4">
          <h2 className="mb-2 text-2xl font-bold text-base-content">Version History</h2>
          <p className="text-sm font-medium text-base-content/60">Auto versioning enabled</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="menu w-full rounded-box">
            {Object.entries(groupHistoryByDay(history)).map(([date, hourGroups], dateIndex) => (
              <li key={date}>
                <details open={dayContainsCurrentVersion(hourGroups)}>
                  <summary className="font-medium">
                    <MdCalendarToday className="h-4 w-4" />
                    {date}
                  </summary>
                  <ul>
                    {Object.entries(hourGroups).map(([hour, items], hourIndex) => (
                      <li key={`${date}-${hour}`}>
                        <details open={groupContainsCurrentVersion(items)}>
                          <summary className="text-sm font-medium">
                            <MdAccessTime className="h-4 w-4" />
                            {hour}
                          </summary>
                          <ul>
                            {items.map((item) => (
                              <li key={item.version}>
                                <button
                                  onClick={() => watchVersionContent(item.version)}
                                  className={`w-full p-3 ${currentVersion === item.version ? 'active text-primary' : ''}`}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">Version {item.version}</span>
                                    <span
                                      className={`text-xs ${
                                        currentVersion === item.version
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
