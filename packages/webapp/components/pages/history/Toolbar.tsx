import React from 'react'
import { MdArrowBack } from 'react-icons/md'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Icon from '@components/TipTap/toolbar/Icon'

interface VersionInfo {
  version: number
  createdAt: string | Date
  isLatestVersion: boolean
}

interface ToolbarProps {
  getCurrentVersionInfo: () => VersionInfo | null
  currentVersion: number | null
  historyLength: number
  onRestore: () => void
}

const DATE_FORMAT_OPTIONS = {
  date: {
    month: 'long',
    day: 'numeric'
  } as const,
  time: {
    hour: 'numeric',
    minute: '2-digit'
  } as const
}

const formatVersionDate = (date: Date | string) => {
  const dateObj = new Date(date)
  return {
    date: dateObj.toLocaleDateString('en-US', DATE_FORMAT_OPTIONS.date),
    time: dateObj.toLocaleTimeString('en-US', DATE_FORMAT_OPTIONS.time)
  }
}

const VersionDisplay: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="text-sm text-base-content/60">{`Version ${current} of ${total}`}</div>
)

const Toolbar: React.FC<ToolbarProps> = ({
  getCurrentVersionInfo,
  currentVersion,
  historyLength,
  onRestore
}) => {
  const handleBackToEditor = () => {
    window.location.hash = ''
  }

  const versionInfo = getCurrentVersionInfo()

  return (
    <div className="toolbar flex flex-col border-b border-gray-200 bg-base-100">
      <div className="flex items-center space-x-2 px-6 py-3">
        <button
          className="btn tooltip tooltip-right h-[38px] min-h-[38px]"
          data-tip="Back to the Editor"
          onClick={handleBackToEditor}
          aria-label="Back to Editor">
          <MdArrowBack size={18} />
        </button>
        <div className="flex h-[38px] w-full items-center space-x-2">
          <div className="ml-auto h-[38px] min-h-[38px]">
            {versionInfo && !versionInfo.isLatestVersion && (
              <button
                className="btn btn-outline tooltip tooltip-bottom h-full bg-docsy text-white"
                onClick={onRestore}
                data-tip={`Restore document to ${versionInfo.version} version`}
                aria-label="Restore this version">
                Restore this version
              </button>
            )}
          </div>
          {versionInfo && (
            <div className="ml-auto text-sm">
              <span className="font-medium">{formatVersionDate(versionInfo.createdAt).date}</span>
              <span className="ml-2 text-base-content/60">
                {formatVersionDate(versionInfo.createdAt).time}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-row items-center justify-between space-x-1 border-t border-gray-200 px-6">
        <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)" aria-label="Print">
          <Icon type="Printer" size={16} />
        </ToolbarButton>

        {currentVersion && <VersionDisplay current={currentVersion} total={historyLength} />}
      </div>
    </div>
  )
}

export default Toolbar
