import BookmarkSheet from '@components/pages/document/components/BookmarkSheet'
import DocumentSettingsSheet from '@components/pages/document/components/DocumentSettingsSheet'
import FilterSheet from '@components/pages/document/components/FilterSheet'
import { type SheetData, type SheetDataMap, type SheetType, useSheetStore } from '@stores'
import { useMemo } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'

import NotificationModal from './notificationPanel/mobile/NotificationModal'
import LinkEditorSheet from './TipTap/hyperlinkPopovers/LinkEditorSheet'
import LinkPreviewSheet from './TipTap/hyperlinkPopovers/LinkPreviewSheet'
import MediaControlsSheet from './TipTap/mediaPopovers/MediaControlsSheet'
import MediaInsertSheet from './TipTap/mediaPopovers/MediaInsertSheet'

// Each renderer receives its sheet's typed payload (`SheetDataMap[K]`) so content
// components stay plain props-driven views. A new sheet needs an entry here plus a
// SheetDataMap key in sheetStore.

type SheetRenderer<K extends Exclude<SheetType, null>> = (data: SheetDataMap[K]) => React.ReactNode

const SHEET_CONTENT: { [K in Exclude<SheetType, null>]: SheetRenderer<K> } = {
  notifications: () => <NotificationModal />,
  filters: () => <FilterSheet />,
  bookmarks: () => <BookmarkSheet />,
  documentSettings: () => <DocumentSettingsSheet />,
  linkPreview: (data) => <LinkPreviewSheet data={data} />,
  linkEditor: (data) => <LinkEditorSheet data={data} />,
  mediaControls: (data) => <MediaControlsSheet data={data} />,
  mediaInsert: (data) => <MediaInsertSheet data={data} />
}

const SHEET_PROPS: Record<Exclude<SheetType, null>, Partial<SheetProps>> = {
  notifications: {
    id: 'notification_sheet',
    detent: 'default'
  },
  filters: {
    id: 'filter_sheet',
    detent: 'content',
    snapPoints: [0, 0.5, 1]
  },
  bookmarks: {
    id: 'bookmark_sheet',
    detent: 'default'
  },
  documentSettings: {
    id: 'document_settings_sheet',
    detent: 'default'
  },
  linkPreview: {
    id: 'link_preview_sheet',
    detent: 'content'
  },
  linkEditor: {
    id: 'link_editor_sheet',
    detent: 'content'
  },
  mediaControls: {
    id: 'media_controls_sheet',
    detent: 'content'
  },
  mediaInsert: {
    id: 'media_insert_sheet',
    detent: 'content'
  }
}

const DEFAULT_SHEET_PROPS: Partial<SheetProps> = { id: 'bottom_sheet' }

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData } = useSheetStore()
  const setSheetState = useSheetStore((state) => state.setSheetState)

  const content = useMemo((): React.ReactNode => {
    if (!activeSheet) return null
    // Single type-narrowing boundary: the registry's per-key signatures
    // are precise (`SheetDataMap[K]`), but the indexed lookup widens
    // back to the union — collapse it here so the renderers themselves
    // stay strictly typed.
    const renderer = SHEET_CONTENT[activeSheet] as (data: SheetData) => React.ReactNode
    return renderer(sheetData)
  }, [activeSheet, sheetData])

  const sheetProps = useMemo<Partial<SheetProps>>(() => {
    if (!activeSheet) return DEFAULT_SHEET_PROPS
    return SHEET_PROPS[activeSheet] ?? DEFAULT_SHEET_PROPS
  }, [activeSheet])

  const handleOpenStart = () => setSheetState('opening')
  const handleOpenEnd = () => setSheetState('open')
  const handleCloseStart = () => setSheetState('closing')
  const handleCloseEnd = () => setSheetState('closed')

  return (
    <div className="bottom-sheet-container relative">
      <Sheet
        avoidKeyboard
        className="bottom-sheet !z-10"
        isOpen={!!activeSheet}
        onClose={closeSheet}
        onOpenStart={handleOpenStart}
        onOpenEnd={handleOpenEnd}
        onCloseStart={handleCloseStart}
        onCloseEnd={handleCloseEnd}
        {...sheetProps}>
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>{content}</Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={closeSheet} />
      </Sheet>
    </div>
  )
}

export default BottomSheet
