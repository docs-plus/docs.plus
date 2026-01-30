import FilterModal from '@components/pages/document/components/FilterModal'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useSheetStore, useStore } from '@stores'
import React, { useEffect, useMemo, useRef } from 'react'
import { Sheet, SheetProps, SheetRef } from 'react-modal-sheet'

import { EmojiPanel } from './chatroom/components/EmojiPanel'
import NotificationModal from './notificationPanel/mobile/NotificationModal'
import ChatContainerMobile from './pages/document/components/chat/ChatContainerMobile'

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData } = useSheetStore()
  const chatRoom = useChatStore((state) => state.chatRoom)
  const closeChatRoom = useChatStore((state) => state.closeChatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const setSheetContainerRef = useSheetStore((state) => state.setSheetContainerRef)
  const setSheetState = useSheetStore((state) => state.setSheetState)
  const _sheetState = useSheetStore((state) => state.sheetState)
  const { keyboardHeight: _keyboardHeight, virtualKeyboardState: _virtualKeyboardState } = useStore(
    (state) => state
  )
  const { deviceDetect } = useStore((state) => state.settings)
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<SheetRef>(null)

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

  // const onSnapHandler = useCallback(
  //   (index: number) => {
  //     const sheetContent = sheetContentRef.current
  //     const sheetY = sheetRef.current?.y?.get()

  //     if (!sheetContent || typeof sheetY !== 'number') return

  //     // Immediate adjustment
  //     sheetContent.style.paddingBottom = `${sheetY}px`

  //     // Delayed fine-tuning for better UX
  //     setTimeout(() => {
  //       // retrieve new sheetY
  //       const sheetY = sheetRef.current?.y?.get()
  //       if (!sheetContent || typeof sheetY !== 'number') return

  //       const padding = sheetY > 0 ? sheetY + 4 : 0
  //       sheetContent.style.paddingBottom = `${padding}px`
  //     }, 200)
  //   },
  //   [sheetContentRef, sheetRef]
  // )

  const getSheetProps = () => {
    switch (activeSheet) {
      case 'filters':
        return {
          id: 'filter_sheet',
          detent: 'content' as SheetProps['detent'],
          snapPoints: [0, 0.5, 1]
        }
      case 'chatroom':
        return {
          id: 'chatroom_sheet',
          detent: 'default' as SheetProps['detent'],
          disableScrollLocking: true,
          disableDismiss: true,
          snapPoints: [0, 0.7, 0.8, 0.9, 1],
          modalEffectThreshold: 0.5
          // onSnap: onSnapHandler
        }
      case 'emojiPicker':
        return {
          id: 'emoji_picker_sheet',
          detent: 'content' as SheetProps['detent']
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

  // useEffect(() => {
  //   if (!sheetContentRef.current) return

  //   const paddingBottom = isDeviceIOS ? Math.round(keyboardHeight).toString() + 'px' : '0px'

  //   switch (activeSheet) {
  //     case 'filters':
  //       sheetContentRef.current.style.paddingBottom = paddingBottom
  //     // case 'chatroom':
  //     // sheetContentRef.current.style.paddingBottom = paddingBottom
  //     case 'emojiPicker':
  //       // sheetContentRef.current.style.paddingBottom =
  //       //   virtualKeyboardState === 'open' ? paddingBottom : '0px'
  //     default:
  //       return
  //   }
  // }, [sheetContentRef, activeSheet, keyboardHeight, isDeviceIOS, virtualKeyboardState, sheetState])

  // NOTE: these events are more reliable than the other events for sheet state
  const onOpenEndHandler = () => setSheetState('closed')
  const onViewportEnterHandler = () => setSheetState('open')
  const onOpenStartHandler = () => setSheetState('opening')
  const onCloseStartHandler = () => setSheetState('closing')

  return (
    <div className="bottom-sheet-container relative">
      <Sheet
        avoidKeyboard={isDeviceIOS}
        className="bottom-sheet !z-10"
        ref={sheetRef}
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
    </div>
  )
}

export default BottomSheet
