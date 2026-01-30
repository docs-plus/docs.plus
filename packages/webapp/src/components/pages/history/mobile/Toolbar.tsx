import Button from '@components/ui/Button'
import { MdArrowBack, MdMenu } from 'react-icons/md'

import { formatVersionDate } from '../helpers'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'

const Toolbar = () => {
  const { handleRestore } = useVersionRestore()
  const versionInfo = useGetVersionInfo()()

  return (
    <div className="docTitle sticky top-0 left-0 z-10 h-auto w-full bg-white">
      <div className="relative z-10 flex min-h-12 w-full flex-col items-center border-b border-gray-300 bg-white p-2">
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="tooltip tooltip-right"
            data-tip="Back to the Editor"
            onClick={() => (window.location.hash = '')}
            aria-label="Back to Editor"
            startIcon={MdArrowBack}
            iconSize={22}
          />
          <div className="divider divider-horizontal m-0 h-10 p-0" />

          {versionInfo && !versionInfo.isLatestVersion && (
            <Button
              variant="primary"
              className="tooltip tooltip-bottom"
              onClick={handleRestore}
              data-tip={`Restore document to ${versionInfo.version} version`}
              aria-label="Restore this version">
              Restore this version
            </Button>
          )}
          {versionInfo && (
            <div className="text-center text-sm">
              <span className="font-medium">{formatVersionDate(versionInfo.createdAt).date}</span>
              <br />
              <span className="text-base-content/60">
                {formatVersionDate(versionInfo.createdAt).time}
              </span>
            </div>
          )}
          <div className="divider divider-horizontal m-0 h-10 p-0" />
          <label
            htmlFor="mobile_history_panel"
            aria-label="close sidebar"
            className="btn btn-ghost drawer-button shrink-0 px-2">
            <MdMenu size={30} />
          </label>
        </div>
      </div>
    </div>
  )
}

export default Toolbar
