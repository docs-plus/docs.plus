import React, { useEffect, useMemo, useRef } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'
import { useSheetStore, useChatStore, useStore } from '@stores'
import FilterModal from '@components/pages/document/components/FilterModal'
import NotificationModal from './notificationPanel/mobile/NotificationModal'
import ChatContainerMobile from './pages/document/components/chat/ChatContainerMobile'
import { EmojiPanel } from './chat/components/EmojiPanel'
import { CHAT_OPEN } from '@services/eventsHub'

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData } = useSheetStore()
  const chatRoom = useChatStore((state) => state.chatRoom)
  const closeChatRoom = useChatStore((state) => state.closeChatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const setSheetContainerRef = useSheetStore((state) => state.setSheetContainerRef)
  const setSheetState = useSheetStore((state) => state.setSheetState)
  const sheetState = useSheetStore((state) => state.sheetState)
  const { keyboardHeight, virtualKeyboardState } = useStore((state) => state)
  const { deviceDetect } = useStore((state) => state.settings)
  const sheetContentRef = useRef<HTMLDivElement>(null)

  const isDeviceIOS = useMemo(() => {
    return deviceDetect?.os() === 'iOS'
  }, [deviceDetect])

  // Sync chat store with bottom sheet
  useEffect(() => {
    if (chatRoom.open && activeSheet !== 'chatroom') {
      // Chat is open in chat store but not in bottom sheet, close chat store
      closeChatRoom()
      destroyChatRoom()
    }
  }, [activeSheet, chatRoom.open, closeChatRoom])

  const renderContent = () => {
    switch (activeSheet) {
      case 'chatroom':
        return <ChatContainerMobile />
      case 'notifications':
        return <NotificationModal />
      case 'filters':
        return <FilterModal />
      case 'emojiPicker':
        return (
          <EmojiPanel variant="mobile">
            <EmojiPanel.Selector />
          </EmojiPanel>
        )
      default:
        return null
    }
  }

  const getSheetProps = () => {
    switch (activeSheet) {
      case 'filters':
        return {
          id: 'filter_sheet',
          detent: 'content-height' as SheetProps['detent']
        }
      case 'chatroom':
        return {
          id: 'chatroom_sheet',
          detent: 'full-height' as SheetProps['detent'],
          disableScrollLocking: true,
          disableDrag: true
        }
      case 'emojiPicker':
        return {
          id: 'emoji_picker_sheet',
          detent: 'content-height' as SheetProps['detent']
        }
      default:
        return {
          id: 'bottom_sheet'
        }
    }
  }

  const handleClose = () => {
    if (activeSheet === 'chatroom') {
      closeChatRoom()
      destroyChatRoom()
      closeSheet()
    } else if (activeSheet === 'emojiPicker' && sheetData.chatRoomState) {
      const { headingId } = sheetData.chatRoomState
      PubSub.publish(CHAT_OPEN, {
        headingId: headingId,
        focusEditor: true,
        clearSheetState: true,
        switchSheet: 'chatroom'
      })
    } else {
      closeSheet()
    }
  }

  useEffect(() => {
    if (!sheetContentRef.current) return

    const paddingBottom = isDeviceIOS ? Math.round(keyboardHeight).toString() + 'px' : '0px'

    switch (activeSheet) {
      case 'filters':
        sheetContentRef.current.style.paddingBottom = paddingBottom
      case 'chatroom':
        sheetContentRef.current.style.paddingBottom = paddingBottom
      case 'emojiPicker':
        sheetContentRef.current.style.paddingBottom =
          virtualKeyboardState === 'open' ? paddingBottom : '0px'
      default:
        return
    }
  }, [sheetContentRef, activeSheet, keyboardHeight, isDeviceIOS, virtualKeyboardState, sheetState])

  // NOTE: these events are more reliable than the other events for sheet state
  const onOpenEndHandler = () => setSheetState('closed')
  const onViewportEnterHandler = () => setSheetState('open')
  const onOpenStartHandler = () => setSheetState('opening')
  const onCloseStartHandler = () => setSheetState('closing')

  return (
    <Sheet
      className="bottom-sheet"
      isOpen={!!activeSheet}
      onClose={handleClose}
      onCloseStart={onCloseStartHandler}
      onOpenStart={onOpenStartHandler}
      onOpenEnd={onOpenEndHandler}
      onViewportEnter={onViewportEnterHandler}
      {...getSheetProps()}>
      <Sheet.Container ref={setSheetContainerRef} onViewportEnter={onViewportEnterHandler}>
        <Sheet.Header />
        <Sheet.Content ref={sheetContentRef}>{renderContent()}</Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={handleClose} />
    </Sheet>
  )
}

export default BottomSheet
