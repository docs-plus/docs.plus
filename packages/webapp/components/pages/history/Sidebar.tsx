import React from 'react'
import { MdRestore } from 'react-icons/md'

interface HistoryItem {
  version: number
  createdAt: string
  commitMessage?: string
}

interface SidebarProps {
  history: HistoryItem[]
  currentVersion: number | null
  watchVersionContent: (version: number) => void
  groupHistoryByDay: (history: HistoryItem[]) => { [date: string]: HistoryItem[] }
}

const Sidebar: React.FC<SidebarProps> = ({
  history,
  currentVersion,
  watchVersionContent,
  groupHistoryByDay
}) => {
  return (
    <div className="sidebar h-full w-[25%] border-l border-gray-200 bg-base-100">
      <div className="flex h-full flex-col">
        <div className="h-[94px] border-gray-200 p-4">
          <h2 className="mb-2 text-2xl font-bold text-base-content">Version History</h2>
          <p className="text-sm font-medium text-base-content/60">Auto versioning enabled</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="menu w-full rounded-box">
            {Object.entries(groupHistoryByDay(history)).map(([date, items], index) => (
              <li key={date}>
                <details open={index === 0}>
                  <summary className="font-medium">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="h-4 w-4">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      />
                    </svg>
                    {date}
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
                              className={`text-xs ${currentVersion === item.version ? 'text-primary' : 'text-base-content/60'}`}>
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
        </div>
      </div>
    </div>
  )
}

export default Sidebar
