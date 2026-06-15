import { PanelTabBar } from '@components/ui/PanelTabBar'
import { usePopoverState } from '@components/ui/Popover'
import { useStore } from '@stores'
import { useEffect, useRef } from 'react'

import { MEDIA_INSERT_TABS } from './mediaInsert'
import MediaUploadDropzone from './MediaUploadDropzone'
import MediaUrlField from './MediaUrlField'
import { useMediaInsert } from './useMediaInsert'

/** Desktop media-insert popover body: tabbed Embed/Upload over the headless `useMediaInsert`. */
const MediaInsertPanel = () => {
  const editor = useStore((state) => state.settings.editor.instance)
  const { close } = usePopoverState()
  const { tab, setTab, url, setUrl, detectedType, inserting, submitUrl, submitFile } =
    useMediaInsert(editor ?? null, { onInserted: close })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(timer)
  }, [tab])

  return (
    <div className="flex w-full flex-col">
      <PanelTabBar tabs={MEDIA_INSERT_TABS} activeTab={tab} onSelect={setTab} />
      <div role="tabpanel" aria-label={tab} className="flex flex-col gap-3 px-4 pt-1 pb-4">
        {tab === 'Embed URL' ? (
          <MediaUrlField
            ref={inputRef}
            value={url}
            onChange={setUrl}
            onSubmit={submitUrl}
            detectedType={detectedType}
            loading={inserting}
          />
        ) : (
          <MediaUploadDropzone onFile={submitFile} />
        )}
      </div>
    </div>
  )
}

export default MediaInsertPanel
