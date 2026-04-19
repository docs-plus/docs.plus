import FilterModal from '@components/pages/document/components/FilterModal'
import {
  CHATROOM_OVERLAY_SHEETS,
  type SheetData,
  type SheetDataMap,
  type SheetType,
  useChatStore,
  useSheetStore,
  useStore
} from '@stores'
import { useEffect, useMemo } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'

import { EmojiPanel } from './chatroom/components/EmojiPanel'
import NotificationModal from './notificationPanel/mobile/NotificationModal'
import ChatContainerMobile from './pages/document/components/chat/ChatContainerMobile'
import LinkEditorSheet from './TipTap/hyperlinkPopovers/LinkEditorSheet'
import LinkPreviewSheet from './TipTap/hyperlinkPopovers/LinkPreviewSheet'

// ---------------------------------------------------------------------------
// Sheet content registry – maps a sheet type to its rendered content.
// Each renderer receives its sheet's typed payload (`SheetDataMap[K]`) so
// content components can be plain props-driven views — no `as` casts at
// the consumer side. Adding a new sheet only requires a new entry here
// plus a SheetDataMap key in sheetStore.
// ---------------------------------------------------------------------------

type SheetRenderer<K extends Exclude<SheetType, null>> = (data: SheetDataMap[K]) => React.ReactNode

const SHEET_CONTENT: { [K in Exclude<SheetType, null>]: SheetRenderer<K> } = {
  chatroom: () => <ChatContainerMobile />,
  notifications: () => <NotificationModal />,
  filters: () => <FilterModal />,
  emojiPicker: () => (
    <EmojiPanel variant="mobile">
      <EmojiPanel.Selector />
    </EmojiPanel>
  ),
  linkPreview: (data) => <LinkPreviewSheet data={data} />,
  linkEditor: (data) => <LinkEditorSheet data={data} />
}

// ---------------------------------------------------------------------------
// Per-sheet configuration for react-modal-sheet
// ---------------------------------------------------------------------------

const SHEET_PROPS: Record<Exclude<SheetType, null>, Partial<SheetProps>> = {
  chatroom: {
    id: 'chatroom_sheet',
    detent: 'default',
    disableScrollLocking: true,
    disableDismiss: true,
    snapPoints: [0, 0.7, 0.8, 0.9, 1],
    modalEffectThreshold: 0.5
  },
  notifications: {
    id: 'notification_sheet',
    detent: 'default'
  },
  filters: {
    id: 'filter_sheet',
    detent: 'content',
    snapPoints: [0, 0.5, 1]
  },
  emojiPicker: {
    id: 'emoji_picker_sheet',
    detent: 'content'
  },
  linkPreview: {
    id: 'link_preview_sheet',
    detent: 'content'
  },
  linkEditor: {
    id: 'link_editor_sheet',
    detent: 'content'
  }
}

const DEFAULT_SHEET_PROPS: Partial<SheetProps> = { id: 'bottom_sheet' }

// ---------------------------------------------------------------------------
// BottomSheet component
// ---------------------------------------------------------------------------

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData, switchSheet } = useSheetStore()
  const closeChatRoom = useChatStore((state) => state.closeChatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const chatRoomOpen = useChatStore((state) => state.chatRoom.open)
  const setSheetContainerRef = useSheetStore((state) => state.setSheetContainerRef)
  const setSheetState = useSheetStore((state) => state.setSheetState)
  const deviceDetect = useStore((state) => state.settings.deviceDetect)

  const isDeviceIOS = useMemo(() => deviceDetect?.os() === 'iOS', [deviceDetect])

  // ---------------------------------------------------------------------------
  // Sync chat store ↔ sheet store
  // When the chatroom sheet is dismissed (and no overlay / pending sheet exists),
  // tear down the chat store so resources are released.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!chatRoomOpen || activeSheet === 'chatroom') return

    // Don't destroy if an overlay sheet (e.g. emojiPicker) is active
    if (activeSheet && CHATROOM_OVERLAY_SHEETS.has(activeSheet)) return

    // Don't destroy while a transition is pending back to chatroom or an overlay
    const { pendingSheet } = useSheetStore.getState()
    if (
      pendingSheet &&
      (pendingSheet.sheet === 'chatroom' || CHATROOM_OVERLAY_SHEETS.has(pendingSheet.sheet))
    ) {
      return
    }

    closeChatRoom()
    destroyChatRoom()
  }, [activeSheet, chatRoomOpen, closeChatRoom, destroyChatRoom])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Close handler – each sheet type may need specific teardown logic
  // ---------------------------------------------------------------------------
  const handleClose = () => {
    switch (activeSheet) {
      case 'chatroom': {
        closeChatRoom()
        destroyChatRoom()
        closeSheet()
        break
      }

      case 'emojiPicker': {
        // If the emoji picker was opened from the chatroom composer,
        // switch back to the chatroom without tearing it down.
        const chatRoomState = (sheetData as { chatRoomState?: { headingId: string } }).chatRoomState

        if (chatRoomState?.headingId) {
          switchSheet('chatroom', { headingId: chatRoomState.headingId })
        } else {
          closeSheet()
        }
        break
      }

      default:
        closeSheet()
    }
  }

  // ---------------------------------------------------------------------------
  // Sheet lifecycle handlers (mapped 1-to-1 with react-modal-sheet callbacks)
  // ---------------------------------------------------------------------------
  const handleOpenStart = () => setSheetState('opening')
  const handleOpenEnd = () => setSheetState('open')
  const handleCloseStart = () => setSheetState('closing')
  const handleCloseEnd = () => setSheetState('closed')

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isChatroom = activeSheet === 'chatroom'

  return (
    <div className="bottom-sheet-container relative">
      <Sheet
        avoidKeyboard={isDeviceIOS}
        className="bottom-sheet !z-10"
        isOpen={!!activeSheet}
        onClose={handleClose}
        onOpenStart={handleOpenStart}
        onOpenEnd={handleOpenEnd}
        onCloseStart={handleCloseStart}
        onCloseEnd={handleCloseEnd}
        {...sheetProps}>
        <Sheet.Container ref={setSheetContainerRef}>
          <Sheet.Header />
          <Sheet.Content
            disableDrag={isChatroom}
            scrollStyle={isChatroom ? { overflowY: 'hidden' } : undefined}>
            {/*
             * Chatroom scroll fix:
             * Sheet.Container has drag="y" (framer-motion). Pointer events that
             * bubble up from the content area reach the Container and trigger
             * sheet drag — stealing the gesture from the inner message-feed
             * scroll container.
             *
             * The wrapper stops pointerdown propagation so the Container never
             * sees it. The browser's native scroll on .message-feed takes over.
             * Sheet.Header (sibling, not inside this wrapper) keeps its own
             * drag handling so the user can still resize the sheet from the
             * handle bar.
             */}
            {isChatroom ? (
              <div className="flex h-full flex-col" onPointerDown={(e) => e.stopPropagation()}>
                {content}
              </div>
            ) : (
              content
            )}
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={handleClose} />
      </Sheet>
    </div>
  )
}

export default BottomSheet
