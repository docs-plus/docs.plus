import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'
import React from 'react'

import { formatVersionDate } from '../helpers'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'

const Toolbar = () => {
  const { activeHistory, historyList } = useStore((state) => state)
  const { handleRestore } = useVersionRestore()
  const versionInfo = useGetVersionInfo()()

  return (
    <div className="toolbar bg-base-100 border-base-300 flex flex-col border-b">
      <div className="flex items-center space-x-2 px-6 py-3">
        <Button
          shape="square"
          onClick={() => (window.location.hash = '')}
          aria-label="Back to Editor"
          startIcon={Icons.back}
          tooltip="Back to the Editor"
          tooltipPlacement="right"
        />
        <div className="flex w-full items-center space-x-3">
          <div className="ml-auto">
            {versionInfo && !versionInfo.isLatestVersion && (
              <Button
                variant="primary"
                className="font-normal"
                onClick={handleRestore}
                aria-label="Restore this version"
                tooltip={`Restore document to ${versionInfo.version} version`}
                tooltipPlacement="bottom">
                Restore this version
              </Button>
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

      <div className="border-base-300 flex flex-row items-center justify-between space-x-1 border-t px-6">
        <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)" aria-label="Print">
          <Icons.print size={16} />
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
