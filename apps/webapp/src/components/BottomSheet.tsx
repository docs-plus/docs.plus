import SignInSheet from '@components/auth/SignInSheet'
import { BookmarkPanel } from '@components/bookmarkPanel'
import MessageReactionSheet from '@components/pages/document/components/chat/MessageReactionSheet'
import HistoryCompareSheet from '@components/pages/history/mobile/HistoryCompareSheet'
import DocumentSettingsPanel from '@components/TipTap/toolbar/desktop/DocumentSettingsPanel'
import FilterPanel from '@components/TipTap/toolbar/desktop/FilterPanel'
import { useHistoryDismiss } from '@hooks/useHistoryDismiss'
import { type SheetData, type SheetDataMap, useSheetStore } from '@stores'
import { useMemo } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'

import { NotificationPanel } from './notificationPanel/desktop/NotificationPanel'
import LinkEditorSheet from './TipTap/hyperlinkPopovers/LinkEditorSheet'
import LinkPreviewSheet from './TipTap/hyperlinkPopovers/LinkPreviewSheet'
import MediaControlsSheet from './TipTap/mediaPopovers/MediaControlsSheet'
import MediaInsertSheet from './TipTap/mediaPopovers/MediaInsertSheet'

type SheetEntry<K extends keyof SheetDataMap> = {
  render: (data: SheetDataMap[K]) => React.ReactNode
} & Partial<SheetProps>

const SHEETS: { [K in keyof SheetDataMap]: SheetEntry<K> } = {
  notifications: {
    id: 'notification_sheet',
    detent: 'default',
    render: () => <NotificationPanel variant="sheet" />
  },
  filters: {
    id: 'filter_sheet',
    detent: 'content',
    snapPoints: [0, 0.5, 1],
    render: () => <FilterPanel variant="sheet" />
  },
  bookmarks: {
    id: 'bookmark_sheet',
    detent: 'default',
    render: () => <BookmarkPanel variant="sheet" />
  },
  documentSettings: {
    id: 'document_settings_sheet',
    detent: 'default',
    render: () => <DocumentSettingsPanel variant="sheet" />
  },
  linkPreview: {
    id: 'link_preview_sheet',
    detent: 'content',
    render: (data) => <LinkPreviewSheet data={data} />
  },
  linkEditor: {
    id: 'link_editor_sheet',
    detent: 'content',
    render: (data) => <LinkEditorSheet data={data} />
  },
  mediaControls: {
    id: 'media_controls_sheet',
    detent: 'content',
    render: (data) => <MediaControlsSheet data={data} />
  },
  mediaInsert: {
    id: 'media_insert_sheet',
    detent: 'content',
    render: (data) => <MediaInsertSheet data={data} />
  },
  historyCompare: {
    id: 'history_compare_sheet',
    detent: 'default',
    render: () => <HistoryCompareSheet />
  },
  messageReaction: {
    id: 'message_reaction_sheet',
    detent: 'content',
    render: () => <MessageReactionSheet />
  },
  signIn: {
    id: 'sign_in_sheet',
    detent: 'content',
    render: (data) => <SignInSheet data={data} />
  }
}

const DEFAULT_SHEET_PROPS: Partial<SheetProps> = { id: 'bottom_sheet' }

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData } = useSheetStore()
  const setSheetState = useSheetStore((state) => state.setSheetState)

  // Every dismiss path (X, scrim, drag) already routes through closeSheet, whether
  // called here or from inside sheet content — see useHistoryDismiss.
  useHistoryDismiss(!!activeSheet, closeSheet)

  const content = useMemo((): React.ReactNode => {
    if (!activeSheet) return null
    const renderer = SHEETS[activeSheet].render as (data: SheetData) => React.ReactNode
    return renderer(sheetData)
  }, [activeSheet, sheetData])

  const sheetProps = useMemo<Partial<SheetProps>>(() => {
    if (!activeSheet) return DEFAULT_SHEET_PROPS
    const { render: _render, ...props } = SHEETS[activeSheet]
    return props
  }, [activeSheet])

  const handleOpenStart = () => setSheetState('opening')
  const handleOpenEnd = () => setSheetState('open')
  const handleCloseStart = () => setSheetState('closing')
  const handleCloseEnd = () => setSheetState('closed')

  return (
    <Sheet
      avoidKeyboard
      className="bottom-sheet !z-50"
      isOpen={!!activeSheet}
      onClose={closeSheet}
      onOpenStart={handleOpenStart}
      onOpenEnd={handleOpenEnd}
      onCloseStart={handleCloseStart}
      onCloseEnd={handleCloseEnd}
      {...sheetProps}>
      <Sheet.Container>
        {/* Empty Header mounts the library DragIndicator. Do not add a house grabber. */}
        <Sheet.Header />
        <Sheet.Content disableScroll>{content}</Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={closeSheet} />
    </Sheet>
  )
}

export default BottomSheet
