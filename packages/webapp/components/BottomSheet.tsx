import React, { useEffect, useRef } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'

import { useSheetStore, useChatStore } from '@stores'
import FilterModal from '@components/pages/document/components/FilterModal'
import NotificationModal from './notificationPanel/mobile/NotificationModal'
import ChatContainerMobile from './pages/document/components/chat/ChatContainerMobile'
import useKeyboardHeight from '@hooks/useKeyboardHeight'

const BottomSheet = () => {
  const { activeSheet, closeSheet } = useSheetStore()
  const chatRoom = useChatStore((state) => state.chatRoom)
  const closeChatRoom = useChatStore((state) => state.closeChatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const setSheetContainerRef = useSheetStore((state) => state.setSheetContainerRef)
  const { height: keyboardHeight } = useKeyboardHeight()

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
          disableScrollLocking: true
        }
      default:
        return {
          id: 'bottom_sheet'
        }
    }
  }

  const getSheetContentProps = () => {
    switch (activeSheet) {
      case 'filters':
        return {
          // Fix the bottom sheet height when keyboard is open
          style: { paddingBottom: keyboardHeight }
        }
      case 'chatroom':
        return {
          style: {
            paddingBottom: keyboardHeight
          }
        }
      default:
        return {}
    }
  }

  const handleClose = () => {
    if (activeSheet === 'chatroom') {
      closeChatRoom()
      destroyChatRoom()
    }
    closeSheet()
  }

  if (!activeSheet) return null

  return (
    <Sheet
      className="bottom-sheet"
      isOpen={!!activeSheet}
      onClose={handleClose}
      {...getSheetProps()}>
      <Sheet.Container ref={setSheetContainerRef}>
        <Sheet.Header />
        <Sheet.Content {...getSheetContentProps()}>{renderContent()}</Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={handleClose} />
    </Sheet>
  )
}

export default BottomSheet
