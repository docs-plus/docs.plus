import { SheetFooter } from '@components/SheetFooter'
import { SheetLayout } from '@components/SheetLayout'
import { PanelTabBar } from '@components/ui/PanelTabBar'
import { type SheetDataMap, useSheetStore } from '@stores'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'

import { MEDIA_INSERT_TABS } from './mediaInsert'
import MediaUploadDropzone from './MediaUploadDropzone'
import MediaUrlField from './MediaUrlField'
import { useMediaInsert } from './useMediaInsert'

/** Mobile media-insert sheet: tabbed Embed/Upload over the headless `useMediaInsert`. */
export default function MediaInsertSheet({ data }: { data: SheetDataMap['mediaInsert'] }) {
  const closeSheet = useSheetStore((s) => s.closeSheet)
  const { tab, setTab, url, setUrl, detectedType, inserting, submitUrl, submitFile } =
    useMediaInsert(data.editor, { onInserted: closeSheet })

  return (
    <SheetLayout
      title="Insert media"
      onClose={closeSheet}
      footer={
        <SheetFooter>
          <button
            type="button"
            className="btn btn-primary min-h-12 w-full text-base font-semibold"
            onClick={closeSheet}>
            Done
          </button>
        </SheetFooter>
      }>
      <div className="flex flex-col pb-3">
        <PanelTabBar tabs={MEDIA_INSERT_TABS} activeTab={tab} onSelect={setTab} />
        <div
          role="tabpanel"
          aria-label={tab}
          className={`flex flex-col gap-3 pt-1 ${sheetBodyPadClassName}`}>
          {tab === 'Embed URL' ? (
            <MediaUrlField
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
    </SheetLayout>
  )
}
