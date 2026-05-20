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
import { type RefObject, useEffect, useMemo, useRef } from 'react'
import { Sheet, SheetProps, type SheetRef } from 'react-modal-sheet'

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

const CHATROOM_SNAP_POINTS: NonNullable<SheetProps['snapPoints']> = [0, 0.7, 0.8, 0.9, 1]
const CHATROOM_TOP_SNAP_INDEX = CHATROOM_SNAP_POINTS.length - 1

const SHEET_PROPS: Record<Exclude<SheetType, null>, Partial<SheetProps>> = {
  chatroom: {
    id: 'chatroom_sheet',
    detent: 'default',
    disableScrollLocking: true,
    disableDismiss: true,
    snapPoints: CHATROOM_SNAP_POINTS,
    initialSnap: CHATROOM_TOP_SNAP_INDEX,
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

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

function isChatroomComposerFocus(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type)
  }
  if (target.isContentEditable) return true
  return Boolean(target.closest('#chatroom-editor, [data-chat-composer-surface]'))
}

function snapSheetToTop(sheetRef: RefObject<SheetRef | null>, snapIndex: number) {
  const run = (attempt: number) => {
    const sheet = sheetRef.current
    if (sheet?.snapPoints?.length) {
      void sheet.snapTo(snapIndex)
      return
    }
    if (attempt < 10) requestAnimationFrame(() => run(attempt + 1))
  }
  run(0)
}

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
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const sheetRef = useRef<SheetRef>(null)
  const sheetContainerRef = useRef<HTMLDivElement | null>(null)

  const mergeSheetContainerRef = (node: HTMLDivElement | null) => {
    sheetContainerRef.current = node
    setSheetContainerRef(node)
  }

  const isChatroom = activeSheet === 'chatroom'
  const chatroomKeyboardExpand = isChatroom && isKeyboardOpen

  // Chatroom: composer focus or keyboard up → full-height snap.
  useEffect(() => {
    if (!isChatroom) return

    const snapFull = () => snapSheetToTop(sheetRef, CHATROOM_TOP_SNAP_INDEX)

    const onFocusIn = (event: FocusEvent) => {
      const el = event.target
      if (!isChatroomComposerFocus(el)) return
      if (!sheetContainerRef.current?.contains(el)) return
      snapFull()
    }

    document.addEventListener('focusin', onFocusIn, true)
    if (isKeyboardOpen) snapFull()

    return () => document.removeEventListener('focusin', onFocusIn, true)
  }, [isChatroom, isKeyboardOpen])

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
    const base = SHEET_PROPS[activeSheet] ?? DEFAULT_SHEET_PROPS
    if (chatroomKeyboardExpand) {
      return { ...base, detent: 'full' }
    }
    return base
  }, [activeSheet, chatroomKeyboardExpand])

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

  return (
    <div className="bottom-sheet-container relative">
      <Sheet
        ref={sheetRef}
        avoidKeyboard
        className="bottom-sheet !z-10"
        isOpen={!!activeSheet}
        onClose={handleClose}
        onOpenStart={handleOpenStart}
        onOpenEnd={handleOpenEnd}
        onCloseStart={handleCloseStart}
        onCloseEnd={handleCloseEnd}
        {...sheetProps}>
        <Sheet.Container ref={mergeSheetContainerRef}>
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
