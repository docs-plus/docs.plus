import React from 'react'
import { MdArrowBack } from 'react-icons/md'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Icon from '@components/TipTap/toolbar/Icon'
import { useStore } from '@stores'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'
import { formatVersionDate } from '../helpers'

const Toolbar = () => {
  const { activeHistory, historyList } = useStore((state) => state)
  const { handleRestore } = useVersionRestore()
  const versionInfo = useGetVersionInfo()()

  return (
    <div className="toolbar bg-base-100 flex flex-col border-b border-gray-200">
      <div className="flex items-center space-x-2 px-6 py-3">
        <button
          className="btn btn-square tooltip tooltip-right"
          data-tip="Back to the Editor"
          onClick={() => (window.location.hash = '')}
          aria-label="Back to Editor">
          <MdArrowBack size={18} />
        </button>
        <div className="flex w-full items-center space-x-3">
          <div className="ml-auto">
            {versionInfo && !versionInfo.isLatestVersion && (
              <button
                className="btn tooltip btn-primary tooltip-bottom font-normal text-white"
                onClick={handleRestore}
                data-tip={`Restore document to ${versionInfo.version} version`}
                aria-label="Restore this version">
                Restore this version
              </button>
            )}
          </div>
          {versionInfo && (
            <div className="ml-auto text-sm">
              <span className="font-medium">{formatVersionDate(versionInfo.createdAt).date}</span>
              <span className="text-base-content/60 ml-2">
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

        {activeHistory && (
          <div className="text-base-content/60 text-sm">
            {`Version ${activeHistory.version} of ${historyList.length}`}
          </div>
        )}
      </div>
    </div>
  )
}

export default Toolbar
